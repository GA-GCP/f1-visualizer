/**
 * The framer-motion feature bundle, in its own module so it can be code-split.
 *
 * `LazyMotion` in App.tsx imports this dynamically; everything else imports `m`
 * rather than `motion`, which keeps only the ~5 kB core renderer in the entry
 * chunk and defers layout projection, drag and gesture handling to this chunk.
 *
 * It has to be `domMax`, not the smaller `domAnimation`: `LayoutMain` uses
 * `layout`/`layoutId` for the route transition, and layout projection only
 * ships in the max bundle. Dropping to `domAnimation` silently turns those into
 * no-ops rather than failing the build.
 */
import { domMax } from 'framer-motion';

export default domMax;
