// eslint-plugin-import-x's rules are ESM and use named imports, which 11 keeps,
// except makeRe. That one comes from index.cjs, which explains why it throws.
import compat from './index.cjs';

export * from 'minimatch-11';
export const makeRe = compat.makeRe;
export default compat;
