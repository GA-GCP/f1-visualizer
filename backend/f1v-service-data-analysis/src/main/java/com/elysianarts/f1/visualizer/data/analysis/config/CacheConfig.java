package com.elysianarts.f1.visualizer.data.analysis.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * In-process caching for reference data (P3).
 *
 * <p>The README described this data as held "in memory". What actually ran was a full remote read
 * of the {@code reference_sessions} or {@code reference_drivers} collection on every call —
 * including {@code searchSessions}, which the frontend issues per keystroke, and {@code
 * getAvailableYears} and {@code getSessionsByYear}, which read every session document only to
 * filter it down in Java.
 *
 * <p>Caffeine sits in front of Firestore, so the remote read happens once per TTL rather than once
 * per request. The TTL is what bounds staleness: the analysis service has no VPC connector, so it
 * cannot subscribe to the Redis invalidation that ingestion could publish after a reference load.
 * Thirty minutes is inside the range that matters for data which changes a few times a season.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    public static final String SESSIONS = "sessions";
    public static final String DRIVERS = "drivers";
    public static final String SESSION_DRIVERS = "sessionDrivers";
    public static final String DRIVER_STATS = "driverStats";

    @Bean
    public CacheManager cacheManager(
            @Value("${f1v.cache.ttl:30m}") Duration ttl,
            @Value("${f1v.cache.max-size:500}") long maxSize) {
        CaffeineCacheManager manager =
                new CaffeineCacheManager(SESSIONS, DRIVERS, SESSION_DRIVERS, DRIVER_STATS);
        manager.setCaffeine(
                Caffeine.newBuilder().expireAfterWrite(ttl).maximumSize(maxSize).recordStats());
        return manager;
    }
}
