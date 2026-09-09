import com.google.cloud.bigquery.BigQuery;
import com.google.cloud.bigquery.QueryJobConfiguration;
import com.google.cloud.bigquery.TableResult;

class BigQueryGuardrailsTest {

    private final BigQuery bigQuery = null;
    private final BigQueryQueryRunner queryRunner = null;

    TableResult direct(QueryJobConfiguration cfg) throws Exception {
        // ruleid: f1v-bigquery-bypasses-guardrails
        return bigQuery.query(cfg);
    }

    TableResult viaRunner(QueryJobConfiguration.Builder builder) throws Exception {
        // ok: f1v-bigquery-bypasses-guardrails
        return queryRunner.query(builder);
    }

    String literalDataset() {
        // ruleid: f1v-bigquery-hardcoded-dataset
        return "SELECT 1 FROM `" + "f1_dataset" + "`.laps";
    }

    String perEnvLiteral() {
        // ruleid: f1v-bigquery-hardcoded-dataset
        return "f1_dataset_prod";
    }

    String fromProperties() {
        // ok: f1v-bigquery-hardcoded-dataset
        return queryRunner.properties().dataset();
    }
}
