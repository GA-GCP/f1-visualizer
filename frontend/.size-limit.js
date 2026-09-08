import { existsSync, readFileSync } from 'node:fs';

// The landing route's first load is the number that matters, and it is not a
// glob: after code splitting, `dist/assets/*.js` also sums lazy route chunks
// that no single page ever downloads. index.html lists exactly the chunks the
// browser fetches before anything renders, so read them from there.
function firstLoadChunks() {
  if (!existsSync('dist/index.html')) {
    throw new Error(
      'Run a build first: yarn build --mode dev (a bare `yarn build` loads no .env and dead-codes Auth0 out).',
    );
  }
  const html = readFileSync('dist/index.html', 'utf8');
  return [...html.matchAll(/assets\/([^"']+\.js)/g)].map((m) => `dist/assets/${m[1]}`);
}

export default [
  {
    name: 'first load — public landing route',
    path: firstLoadChunks(),
    limit: '250 kB',
    gzip: true,
  },
  {
    // Raised twice, both times for a named and measured trade rather than to
    // make a failing gate pass. This budget exists to catch a stray
    // dependency, not to absorb one, so each raise records its reason:
    //
    //   380 -> 390 kB  runtime validation at the API boundary (~7 kB gz)
    //   390 -> 405 kB  React Compiler (+14.7 kB gz, measured per chunk:
    //                  VersusMode +4.2, Home +3.9, entry +3.0, the rest
    //                  spread across 41 compiled components / 988 cache
    //                  slots). Vendor chunks are byte-identical — the
    //                  compiler does not touch node_modules.
    //
    // This is the total across *all* chunks, most of which are lazy route
    // chunks behind the login. The number a first-time visitor actually
    // feels is the first-load budget above, and the compiler costs that
    // 3.1 kB, not 14.7.
    name: 'total JS shipped (all chunks)',
    path: 'dist/assets/*.js',
    limit: '405 kB',
    gzip: true,
  },
];
