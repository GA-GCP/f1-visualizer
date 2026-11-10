# minimatch-compat

minimatch 11, served in the shapes that minimatch 3.x and 10.x consumers import. It exists so
that no copy of minimatch below 11.0.1 is installed, which is the affected range of
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) (denial of service
through globparts amplification).

## Why a shim rather than an override

Dependabot could not fix the alert, because every package that depends on minimatch caps its
range below 11. Forcing 11 with a plain override works for some of them and breaks others:

| Consumer                               | Range                 | On minimatch 11                    |
| -------------------------------------- | --------------------- | ---------------------------------- |
| `eslint`                               | `^10.2.5`             | works: plain override              |
| `@eslint/config-array`                 | `^10.2.4`             | works: plain override              |
| `@typescript-eslint/typescript-estree` | `^10.2.2`             | works: plain override              |
| `eslint-plugin-import-x`               | `^9.0.3 \|\| ^10.1.2` | **breaks**: imports `makeRe`       |
| `eslint-plugin-react`                  | `^3.1.2`              | **breaks**: calls the module as fn |
| `eslint-plugin-jsx-a11y`               | `^3.1.2`              | **breaks**: calls the module as fn |

minimatch 3.x exported the matcher function itself, and 11 exports a plain object, so
`require('minimatch')(path, pattern)` throws. 11 also removed `makeRe()`, and import-x's ESM
rules import it by name, so ESLint fails to load the plugin at all.

The three that break get this package instead, through `overrides` in `../../pnpm-workspace.yaml`:

- `index.cjs` (`require`): a function that delegates to 11, with 11's API as properties.
- `index.mjs` (`import`): 11's named exports, plus `makeRe` and a default export.

## makeRe

minimatch 11 has no `makeRe()` and no compiled regexp to build one from, so the shim's `makeRe`
throws an error that names itself. Its only caller is `import-x/no-internal-modules`, which this
config does not turn on. A missing export would stop every import-x rule from loading, and a
regex that matches nothing would let lint pass silently, so throwing is the safer failure. If
that rule is ever turned on, ESLint will report this error the first time it runs.

## What it changes in practice

Traced over `pnpm lint` on the whole tree:

- **react and jsx-a11y:** none of the rules this config turns on call minimatch, so the shim is
  loaded and never called.
- **import-x:** `import-x/order` calls `minimatch(path, '@/**')` once per import, for the `@/`
  path group: 328 calls over 189 distinct paths. minimatch 11 and the 10.2.6 it replaced agree on
  all 328.

## Maintenance

- `version` matches the minimatch it wraps, so anything that reads the installed package as
  `minimatch` sees 11.0.3 rather than a lower number that would read as vulnerable.
  `pnpm-lock.yaml` records it by path, as `minimatch-compat@file:shims/minimatch-compat`.
- pnpm copies `file:` packages into `node_modules` at install time. After editing this
  directory, run `pnpm install --force` locally, or the old copy stays in `node_modules`.
- The Dockerfile copies `shims/` before `pnpm install` for the same reason.

## Removing it

Delete this directory and its three `file:` overrides once eslint-plugin-react and
eslint-plugin-jsx-a11y accept minimatch 11 or drop it, and eslint-plugin-import-x accepts 11
([un-ts/eslint-plugin-import-x#570](https://github.com/un-ts/eslint-plugin-import-x/pull/570)).
The three `^11.0.3` overrides can go when those packages' own ranges include 11.
