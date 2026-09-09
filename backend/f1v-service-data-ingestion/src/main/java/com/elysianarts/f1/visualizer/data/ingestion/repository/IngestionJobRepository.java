package com.elysianarts.f1.visualizer.data.ingestion.repository;

import com.elysianarts.f1.visualizer.data.ingestion.model.IngestionJob;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutionException;

/**
 * Job status in Firestore, so it survives the restart that a deploy causes and
 * can be read back by whoever started the load (R3).
 */
@Slf4j
@Repository
@RequiredArgsConstructor
public class IngestionJobRepository {

    static final String COLLECTION = "ingestion_jobs";

    private final Firestore firestore;

    public void save(IngestionJob job) {
        Map<String, Object> document = new HashMap<>();
        document.put("id", job.id());
        document.put("type", job.type().name());
        document.put("target", job.target());
        document.put("status", job.status().name());
        document.put("createdAt", job.createdAt().toString());
        document.put("updatedAt", job.updatedAt().toString());
        document.put("detail", job.detail());

        try {
            firestore.collection(COLLECTION).document(job.id()).set(document).get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("job save interrupted job_id={}", job.id(), e);
        } catch (ExecutionException e) {
            // A lost status update must not fail the load it is describing.
            log.error("job save failed job_id={} status={}", job.id(), job.status(), e);
        }
    }

    public Optional<IngestionJob> find(String jobId) {
        try {
            DocumentSnapshot document = firestore.collection(COLLECTION).document(jobId).get().get();
            if (!document.exists()) {
                return Optional.empty();
            }
            return Optional.of(new IngestionJob(
                    document.getString("id"),
                    IngestionJob.Type.valueOf(document.getString("type")),
                    document.getString("target"),
                    IngestionJob.Status.valueOf(document.getString("status")),
                    Instant.parse(document.getString("createdAt")),
                    Instant.parse(document.getString("updatedAt")),
                    document.getString("detail")));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (ExecutionException e) {
            log.error("job read failed job_id={}", jobId, e);
            return Optional.empty();
        }
    }
}
