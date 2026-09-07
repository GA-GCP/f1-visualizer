import { existsSync, readFileSync } from 'node:fs';

// The landing route's first load is the number that matters, and it is not a
// glob: after code splitting, `dist/assets/*.js` also sums lazy route chunks
// that no single page ever downloads. index.html lists exactly the chunks the
// browser fetches before anything renders, so read them from there.
function firstLoadChunks() {
    if (!existsSync('dist/index.html')) {
        throw new Error('Run a build first: yarn build --mode dev (a bare `yarn build` loads no .env and dead-codes Auth0 out).');
    }
    const html = readFileSync('dist/index.html', 'utf8');
    return [...html.matchAll(/assets\/([^"']+\.js)/g)].map(m => `dist/assets/${m[1]}`);
}

export default [
    {
        name: 'first load — public landing route',
        path: firstLoadChunks(),
        limit: '250 kB',
        gzip: true,
    },
    {
        name: 'total JS shipped (all chunks)',
        path: 'dist/assets/*.js',
        limit: '380 kB',
        gzip: true,
    },
];
