package com.elysianarts.f1.visualizer.data.ingestion.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * A per-caller ceiling on playback commands (S1).
 *
 * <p>Play, pause and seek change what every other viewer is watching, and every seek costs a
 * synchronous BigQuery query. They stay open to any authenticated user because that is the product,
 * so the limit is what stops one client — or one stuck scrubber — from driving the replay for
 * everyone.
 *
 * <p>The counters are per instance, which is exact here rather than approximate: ingestion runs
 * pinned to a single always-on instance because the replay engine is stateful (R1).
 */
@Slf4j
@Component
public class PlaybackRateLimitInterceptor implements HandlerInterceptor {

    /** Bounded so an unbounded set of subjects cannot grow the map without limit. */
    private static final int MAX_TRACKED_SUBJECTS = 1_000;

    private final int permitsPerWindow;
    private final long windowMillis;

    private final Map<String, Window> windows =
            Collections.synchronizedMap(
                    new LinkedHashMap<>(MAX_TRACKED_SUBJECTS + 1, 0.75f, true) {
                        @Override
                        protected boolean removeEldestEntry(Map.Entry<String, Window> eldest) {
                            return size() > MAX_TRACKED_SUBJECTS;
                        }
                    });

    private static final class Window {
        long startMillis;
        int count;
    }

    public PlaybackRateLimitInterceptor(
            @Value("${f1v.playback.rate-limit.permits:20}") int permitsPerWindow,
            @Value("${f1v.playback.rate-limit.window:10s}") Duration window) {
        this.permitsPerWindow = permitsPerWindow;
        this.windowMillis = window.toMillis();
    }

    @Override
    public boolean preHandle(
            HttpServletRequest request, HttpServletResponse response, Object handler) {
        String subject = currentSubject();
        long now = System.currentTimeMillis();

        synchronized (windows) {
            Window w = windows.computeIfAbsent(subject, k -> new Window());
            if (now - w.startMillis >= windowMillis) {
                w.startMillis = now;
                w.count = 0;
            }
            if (++w.count > permitsPerWindow) {
                log.warn(
                        "playback rate limit exceeded subject={} path={}",
                        subject,
                        request.getRequestURI());
                throw new ResponseStatusException(
                        HttpStatus.TOO_MANY_REQUESTS,
                        "Too many playback commands. Try again shortly.");
            }
        }
        return true;
    }

    private static String currentSubject() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return (authentication != null && authentication.getName() != null)
                ? authentication.getName()
                : "anonymous";
    }
}
