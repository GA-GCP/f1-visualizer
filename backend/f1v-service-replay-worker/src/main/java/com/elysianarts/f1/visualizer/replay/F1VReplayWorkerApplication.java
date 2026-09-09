package com.elysianarts.f1.visualizer.replay;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * The replay worker (R1).
 *
 * <p>The replay engine, its chunk prefetcher and the MQTT bridge are stateful singletons: playback
 * position, mode and the broker connection all lived in one JVM's memory. They shared a deployment
 * with the stateless HTTP loaders, and Cloud Run was free to run five of those — so a play, pause
 * or seek could land on an instance that was not running the replay, and a scale-down discarded it.
 * Between requests, the platform also throttled the 250 ms tick loop and the MQTT callbacks to
 * near-zero CPU.
 *
 * <p>They run here now: one always-on instance with CPU always allocated, taking commands from a
 * Redis stream and publishing its state back to Redis, so the API scales freely and a restart
 * resumes rather than forgets.
 */
@EnableScheduling
@ConfigurationPropertiesScan("com.elysianarts.f1.visualizer")
@SpringBootApplication(
        scanBasePackages = {
            "com.elysianarts.f1.visualizer.replay",
            "com.elysianarts.f1.visualizer.commons"
        })
public class F1VReplayWorkerApplication {
    public static void main(String[] args) {
        SpringApplication.run(F1VReplayWorkerApplication.class, args);
    }
}
