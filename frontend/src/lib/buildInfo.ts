import { createLogger } from './logger';

const log = createLogger('build');

/**
 * Which build is running.
 *
 * Nothing in the served page used to say. Cloud Build knew `_SHORT_SHA` but
 * never passed it into Vite, so during an incident 'which build are you on?'
 * had no answer, and a reported error could not be mapped to a commit or to a
 * deploy time. Both values are substituted at build time by `define` in
 * vite.config.ts — see that file for where they come from.
 */
export const buildInfo = {
    /** Short commit SHA, or 'local' for a developer build. */
    version: __APP_VERSION__,
    /** ISO 8601, from SOURCE_DATE_EPOCH when set, else the build's own clock. */
    buildTime: __BUILD_TIME__,
    /** 'dev' | 'uat' | 'prod' | 'development' — whichever --mode built it. */
    mode: import.meta.env.MODE,
} as const;

export type BuildInfo = typeof buildInfo;

/**
 * Publishes the build identity to the two places support actually looks: the
 * console, and a global they can read from the address bar.
 *
 * `console.info` rather than the scoped logger's info level, which is dropped
 * outside DEV — this one line is the point of the exercise and has to survive
 * in production.
 */
export function publishBuildInfo(target: Window = window): void {
    (target as Window & { __F1V__?: BuildInfo }).__F1V__ = buildInfo;

    log.debug('build info published', buildInfo);
    console.info(`f1v ${buildInfo.version} · ${buildInfo.mode} · built ${buildInfo.buildTime}`);
}
