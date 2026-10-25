<!-- Keep this in English. See the language and commit conventions in CONTRIBUTING.md. -->
<!-- Title format: Conventional Commits — <type>(<scope>): <summary in imperative mood> -->
<!-- Examples: feat(cli): accept external fixture path, fix(app): prevent window leak -->

## Problem

<!-- The bug, friction or gap this closes. Link the issue. -->

## What changed

<!-- The change in a few sentences. -->

## Scope and boundary

<!-- What this touches and what it explicitly does not. -->

## Verification

<!-- The commands you ran and their real result. Paste output, not a promise. -->
```powershell
pnpm test
```

## Tradeoffs and limits

<!-- What this gives up, and what remains unknown, manual or untested. -->

## Durable docs

- [ ] `.csdd/specs.md` or `.csdd/decisions.md` updated, or not affected
- [ ] README, CONTRIBUTING or a stage guide updated, or not affected

## Agent assistance

<!-- Name the agent or model that helped, or write "None". The person opening this pull request is responsible for the diff and for the verification above. -->

## Checklist

- [ ] PR title follows Conventional Commits (`<type>(<scope>): <summary>`)
- [ ] Tests pass and new behavior is covered
- [ ] No credentials, private profile data or private project paths
- [ ] Documentation and issue/PR text are in English
- [ ] Generated brand material and ignored outputs stay out of the commit
