# minimatch-compat

minimatch 11, served in the shapes that minimatch 3.x and 10.x consumers import. It exists so
that no copy of minimatch below 11.0.1 is installed, which is the affected range of
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) (denial of service
through globparts amplification).

## Why a shim rather than a resolution

Dependabot could not fix the alert, because every package that depends on minimatch caps its
range below 11. Forcing 11 with a plain resolution works for some of them and breaks others:

| Consumer                               | Range                 | On minimatch 11                    |
| -------------------------------------- | --------------------- | ---------------------------------- |
| `eslint`                               | `^10.2.5`             | works: plain resolution            |
| `@eslint/config-array`                 | `^10.2.4`             | works: plain resolution            |
| `@typescript-eslint/typescript-estree` | `^10.2.2`             | works: plain resolution            |
| `eslint-plugin-import-x`               | `^9.0.3 \|\| ^10.1.2` | **breaks**: imports `makeRe`       |
| `eslint-plugin-react`                  | `^3.1.2`              | **breaks**: calls the module as fn |
| `eslint-plugin-jsx-a11y`               | `^3.1.2`              | **breaks**: calls the module as fn |

minimatch 3.x exported the matcher function itself, and 11 exports a plain object, so
`require('minimatch')(path, pattern)` throws. 11 also removed `makeRe()`, and import-x's ESM
rules import it by name, so ESLint fails to load the plugin at all.

The three that break get this package instead, through `resolutions` in `../../package.json`:

- `index.cjs` (`require`): a function that delegates to 11, with 11's API as properties.
- `index.mjs` (`import`): 11's named exports, plus `makeRe` and a default export.

## makeRe

minimatch 11 has no `makeRe()` and no compiled regexp to build one from, so the shim's `makeRe`
throws an error that names itself. Its only caller is `import-x/no-internal-modules`, which this
config does not turn on. A missing export would stop every import-x rule from loading, and a
regex that matches nothing would let lint pass silently, so throwing is the safer failure. If
that rule is ever turned on, ESLint will report this error the first time it runs.

## What it changes in practice

Traced over `yarn lint` on the whole tree:

- **react and jsx-a11y:** none of the rules this config turns on call minimatch, so the shim is
  loaded and never called.
- **import-x:** `import-x/order` calls `minimatch(path, '@/**')` once per import, for the `@/`
  path group: 328 calls over 189 distinct paths. minimatch 11 and the 10.2.6 it replaced agree on
  all 328.

## Maintenance

- `version` matches the minimatch it wraps. The lockfile records this package under the name
  `minimatch` at that version, which is what anything reading `yarn.lock` sees, so a lower
  number would read as a vulnerable minimatch.
- yarn copies `file:` packages at install time. After editing this directory, run
  `yarn install --force` locally, or the old copy stays in `node_modules`.
- The Dockerfile copies `shims/` before `yarn install` for the same reason.

## Removing it

Delete this directory and its three `file:` resolutions once eslint-plugin-react and
eslint-plugin-jsx-a11y accept minimatch 11 or drop it, and eslint-plugin-import-x accepts 11
([un-ts/eslint-plugin-import-x#570](https://github.com/un-ts/eslint-plugin-import-x/pull/570)).
The three `^11.0.3` resolutions can go when those packages' own ranges include 11.
