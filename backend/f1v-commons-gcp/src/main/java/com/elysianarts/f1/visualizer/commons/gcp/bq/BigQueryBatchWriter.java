package com.elysianarts.f1.visualizer.commons.gcp.bq;

import com.google.cloud.bigquery.BigQuery;
import com.google.cloud.bigquery.FormatOptions;
import com.google.cloud.bigquery.Job;
import com.google.cloud.bigquery.JobStatistics;
import com.google.cloud.bigquery.TableDataWriteChannel;
import com.google.cloud.bigquery.TableId;
import com.google.cloud.bigquery.WriteChannelConfiguration;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/**
 * Writes rows into BigQuery with a batch load job rather than a streaming insert.
 *
 * <p><b>Why not {@code insertAll} (R4).</b> The four session loaders called it with no {@code
 * insertId} and never cleared existing rows, so re-running a load inserted everything a second time
 * and the lap-time chart doubled. Worse, rows written that way sit in the streaming buffer for up
 * to about 90 minutes and cannot be removed by DML — which is why {@code ReferenceDataLoader}'s
 * delete-then-insert could leave stale rows behind when run twice in a row.
 *
 * <p>A batch load job has neither problem: the rows are immediately visible to DML, so a load can
 * safely delete what a previous run wrote and replace it. It also costs nothing, where streaming
 * inserts are billed per byte.
 */
@Slf4j
/** Built only where a dataset is configured; see {@link BigQueryConfig}. */
@ConditionalOnProperty(name = "f1v.bigquery.dataset")
@Component
public class BigQueryBatchWriter {

    private final BigQuery bigQuery;
    private final ObjectMapper mapper = JsonMapper.builder().findAndAddModules().build();

    public BigQueryBatchWriter(BigQuery bigQuery) {
        this.bigQuery = bigQuery;
    }

    /**
     * Appends rows to a table and blocks until the load job completes.
     *
     * @return the number of rows the job reported writing
     */
    public long append(String dataset, String table, List<Map<String, Object>> rows) {
        if (rows.isEmpty()) {
            return 0;
        }

        WriteChannelConfiguration configuration =
                WriteChannelConfiguration.newBuilder(TableId.of(dataset, table))
                        .setFormatOptions(FormatOptions.json())
                        .setWriteDisposition(
                                com.google.cloud.bigquery.JobInfo.WriteDisposition.WRITE_APPEND)
                        .build();

        try (TableDataWriteChannel writer = bigQuery.writer(configuration)) {
            for (Map<String, Object> row : rows) {
                // Newline-delimited JSON: one object per line, streamed rather than
                // assembled, so a large window does not have to fit in memory twice.
                byte[] line =
                        (mapper.writeValueAsString(row) + "\n").getBytes(StandardCharsets.UTF_8);
                writer.write(ByteBuffer.wrap(line));
            }
            writer.close();

            Job job = writer.getJob().waitFor();
            if (job == null) {
                throw new IllegalStateException("BigQuery load job disappeared before completion");
            }
            if (job.getStatus().getError() != null) {
                throw new IllegalStateException(
                        "BigQuery load job failed: " + job.getStatus().getError());
            }
            long written = ((JobStatistics.LoadStatistics) job.getStatistics()).getOutputRows();
            log.info("bigquery load complete table={}.{} rows={}", dataset, table, written);
            return written;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to write rows to " + dataset + "." + table, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted waiting for the BigQuery load job", e);
        }
    }
}
