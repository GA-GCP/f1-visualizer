package com.elysianarts.f1.visualizer.data.ingestion.config;

import java.util.concurrent.ThreadPoolExecutor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class IngestionAsyncConfig {

    /**
     * Where historical and reference loads run (R3).
     *
     * <p>Deliberately narrow: one at a time, with a short queue. A load is minutes of OpenF1 calls
     * and BigQuery writes against a service pinned to a single always-on instance (R1), so
     * concurrency here buys nothing and would only multiply the rate-limit pressure on OpenF1. The
     * bounded queue with an abort policy means an overloaded service says so — the controller turns
     * the rejection into a 429 — rather than accumulating work it will never reach.
     */
    @Bean("ingestionJobExecutor")
    public ThreadPoolTaskExecutor ingestionJobExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(4);
        executor.setThreadNamePrefix("ingestion-job-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        // Let an in-flight load finish rather than tearing it down mid-write.
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        return executor;
    }
}
