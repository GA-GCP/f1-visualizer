package com.elysianarts.f1.visualizer.data.ingestion.service;

import com.elysianarts.f1.visualizer.data.ingestion.model.IngestionJob;
import com.elysianarts.f1.visualizer.data.ingestion.repository.IngestionJobRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

/**
 * Accepts a load, hands back a job id, and runs the work behind it (R3).
 */
@Slf4j
@Service
public class IngestionJobService {

    private final IngestionJobRepository repository;
    private final TaskExecutor executor;

    public IngestionJobService(IngestionJobRepository repository,
                               @Qualifier("ingestionJobExecutor") TaskExecutor executor) {
        this.repository = repository;
        this.executor = executor;
    }

    public IngestionJob submit(IngestionJob.Type type, String target, Runnable work) {
        IngestionJob job = IngestionJob.accepted(type, target);
        repository.save(job);

        try {
            executor.execute(() -> run(job, work));
        } catch (TaskRejectedException e) {
            repository.save(job.to(IngestionJob.Status.FAILED, "Rejected: the ingestion queue is full"));
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "An ingestion load is already queued. Try again once it finishes.");
        }

        log.info("job accepted job_id={} type={} target={}", job.id(), type, target);
        return job;
    }

    public Optional<IngestionJob> find(String jobId) {
        return repository.find(jobId);
    }

    private void run(IngestionJob job, Runnable work) {
        repository.save(job.to(IngestionJob.Status.RUNNING, null));
        long startedAt = System.nanoTime();
        try {
            work.run();
            long seconds = (System.nanoTime() - startedAt) / 1_000_000_000L;
            repository.save(job.to(IngestionJob.Status.SUCCEEDED, "Completed in " + seconds + "s"));
            log.info("job succeeded job_id={} duration_seconds={}", job.id(), seconds);
        } catch (Exception e) {
            // The message goes to the job record, which only an ingest:admin can
            // read — not to an anonymous 5xx body.
            repository.save(job.to(IngestionJob.Status.FAILED, e.getMessage()));
            log.error("job failed job_id={} type={} target={}", job.id(), job.type(), job.target(), e);
        }
    }
}
