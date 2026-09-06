// jest-image-snapshot ships Jest-shaped types, so its matcher is not visible on
// Vitest's assertion chain. Declare it against Vitest's `Matchers` extension point.
import 'vitest';
import type { MatchImageSnapshotOptions } from 'jest-image-snapshot';

declare module 'vitest' {
    interface Matchers<
        R extends void | Promise<void> = void | Promise<void>,
        // `T` is required to match Vitest's own signature for declaration merging.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        T = unknown
    > {
        toMatchImageSnapshot(options?: MatchImageSnapshotOptions): R;
    }
}
