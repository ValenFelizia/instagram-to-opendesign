# Security policy

## Supported versions

There is no released build. `main` is the only supported line, and fixes land there.

## Reporting a vulnerability

Report privately through [GitHub Security Advisories](https://github.com/ValenFelizia/instagram-to-opendesign/security/advisories/new). Do not open a public issue.

Include the affected command or screen, the platform, the commit you tested and the smallest reproduction you can share. Use synthetic data and your own credentials.

This is a single-maintainer project. Expect an initial reply within about a week. There is no bounty and no response-time guarantee.

## In scope

- Provider credentials, and any path that can store, log, export or return them.
- Local project data, backups, exports and trash boundaries.
- Desktop IPC, preload exposure and renderer isolation.
- Path handling, archive extraction and containment on Windows.
- Provider responses that could be presented as verified brand facts.

## Out of scope

- Instagram terms-of-service, rate-limit or account questions. Report those to Instagram or to the extraction provider.
- Vulnerabilities in Apify, OpenAI, Electron or OpenDesign itself. Report them upstream.
- Findings that require a machine or account you already control, with no effect on another user.

## Disclosure

I will credit the reporter unless you ask otherwise. I will publish an advisory once a fix or mitigation is available.

## Safe harbor

I will not pursue action against research that stays within this policy, uses synthetic data or your own accounts, and does not degrade the project for anyone else.
