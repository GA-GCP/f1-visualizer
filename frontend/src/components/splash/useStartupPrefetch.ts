import { useEffect, useRef, useState } from 'react';
import { createLogger } from '../../lib/logger';

const log = createLogger('startup');

export interface PrefetchTask {
    /** Stable identifier, shown to the user if this task is the one that fails. */
    name: string;
    /** Wait this long before starting. Used to stagger API calls. */
    delayMs?: number;
    run: () => Promise<unknown>;
}

export interface StartupPrefetchState {
    /** 0..1 — the fraction of tasks that have settled, fulfilled or rejected. */
    readiness: number;
    settled: number;
    total: number;
    /** Names of tasks that rejected. Empty while startup is healthy. */
    failures: string[];
}

/**
 * Runs the post-login prefetch set and reports how much of it has settled.
 *
 * Two things this fixes over the old `void fetchDrivers()` calls: the splash can
 * be gated on real progress instead of a wall clock, and a rejection is
 * observed rather than becoming an unhandled promise rejection that the user
 * only discovers as an empty dashboard.
 *
 * A rejected task still counts as settled — a failed prefetch must not hold the
 * splash open, because the page underneath can fetch and report its own errors.
 */
export function useStartupPrefetch(tasks: PrefetchTask[], enabled: boolean): StartupPrefetchState {
    const [settled, setSettled] = useState(0);
    const [failures, setFailures] = useState<string[]>([]);
    const startedRef = useRef(false);

    useEffect(() => {
        if (!enabled || startedRef.current) return;
        startedRef.current = true;

        let cancelled = false;
        const timers: ReturnType<typeof setTimeout>[] = [];

        const settle = (task: PrefetchTask, ok: boolean, error?: unknown) => {
            if (cancelled) return;
            if (!ok) {
                log.error(`[startup] Prefetch failed: ${task.name}`, error);
                setFailures((prev) => [...prev, task.name]);
            }
            setSettled((prev) => prev + 1);
        };

        for (const task of tasks) {
            const start = () => {
                task.run().then(
                    () => settle(task, true),
                    (error: unknown) => settle(task, false, error),
                );
            };
            if (task.delayMs) {
                timers.push(setTimeout(start, task.delayMs));
            } else {
                start();
            }
        }

        return () => {
            cancelled = true;
            for (const timer of timers) clearTimeout(timer);
        };
    }, [enabled, tasks]);

    const total = tasks.length;
    return {
        readiness: total === 0 ? 1 : settled / total,
        settled,
        total,
        failures,
    };
}
