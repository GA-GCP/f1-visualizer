## What this changes

<!-- One or two sentences. What behaviour is different after this merges? -->

## Why

<!-- The problem, not the patch. Link the issue or finding if there is one. -->

## How it was verified

<!-- What you actually ran or looked at — not what the CI will run for you.
     "Tested locally" is not verification; "324 tests pass, and the trace
     renders identically against the image snapshots" is. -->

## Checklist

- [ ] `yarn typecheck`, `yarn lint` and `yarn test:ci` pass locally
- [ ] `yarn size` is within budget, or the budget change is justified in the diff
- [ ] UI changes include a before/after screenshot
- [ ] Commit messages are Conventional Commits — they become the CHANGELOG
- [ ] Infrastructure changes include the `tofu plan` output
- [ ] Anything deliberately left out is called out below

## Notes for the reviewer

<!-- Judgement calls worth a second opinion, and anything you chose not to do. -->
