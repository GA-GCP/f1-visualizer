// jest-image-snapshot ships no types. @types/jest-image-snapshot supplied them,
// but it depends on @types/jest, which brings in expect → jest-message-util →
// micromatch → braces, and braces 3.0.3 carries GHSA-vfj7-8cjw-p6xm with no
// patched release: a high advisory in code nothing here runs, failing the
// dependency audit on every PR. Declaring what the visual tests use removes
// that whole chain from the install.
//
// Only the options CircuitTrace.visual.test.ts passes are declared. Reaching for
// another one is a type error until it is added here.
declare module 'jest-image-snapshot' {
    export interface MatchImageSnapshotOptions {
        /** Names the stored baseline instead of deriving it from the test name. */
        customSnapshotIdentifier?: string;
        /** How much may differ before the comparison fails, in `failureThresholdType` units. */
        failureThreshold?: number;
        failureThresholdType?: 'pixel' | 'percent';
    }

    export interface ImageSnapshotResult {
        pass: boolean;
        message(): string;
    }

    /** The matcher itself, registered with `expect.extend`. */
    export function toMatchImageSnapshot(
        received: unknown,
        options?: MatchImageSnapshotOptions,
    ): ImageSnapshotResult;
}
