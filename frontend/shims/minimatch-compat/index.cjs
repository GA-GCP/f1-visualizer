'use strict';

// minimatch 3.x exported the matcher function itself, with the rest of the API
// hung off it; 11 exports a plain object. eslint-plugin-react and
// eslint-plugin-jsx-a11y call `require('minimatch')(path, pattern)`, so they
// get a function back here, carrying 11's API as properties.
const mm = require('minimatch-11');

function minimatch(path, pattern, options) {
    return mm.minimatch(path, pattern, options);
}

// 11 removed makeRe, and there is no public way to rebuild it: Minimatch lost
// makeRe() and the compiled regexp along with it. Its one caller here is
// import-x/no-internal-modules, which this config does not turn on. Failing by
// name beats the alternatives: a missing export breaks the ESM import of every
// import-x rule, and a regex that matches nothing passes lint silently.
function makeRe() {
    throw new Error(
        'minimatch-compat: makeRe() does not exist in minimatch 11, so a rule that ' +
            'needs it (import-x/no-internal-modules) cannot run. See ' +
            'frontend/shims/minimatch-compat/README.md.',
    );
}

module.exports = Object.assign(minimatch, mm, { minimatch, makeRe });
