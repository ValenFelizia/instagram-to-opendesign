# Contributing

Thanks for your interest. Start with a focused GitHub issue or discussion before implementing a large pipeline change.

## Ground rules

- Write repository documentation, CSDD state, issue titles/bodies, pull request titles/descriptions, review notes and project comments in English, even when discussing the work in another language. See the [language policy](.csdd/specs.md#language-policy).
- Generated reports default to Spanish for brand-owner review and support English with `--lang en`. Preserve original evidence, quotations and confirmed brand copy in their original language; identify translations as translations.
- Keep contributions compatible with OpenDesign's current package format. Record the source and revision used to verify a compatibility claim.
- Preserve evidence and confidence for brand inferences. Avoid presenting unverified visual observations as rules.
- Do not commit access tokens, private profile data, third-party images without redistribution rights, or generated brand packages containing such material.
- Keep changes small and explain how you verified them in the pull request.

Technical implementation and agent coordination use [GitHub Issues](https://github.com/ValenFelizia/instagram-to-opendesign/issues), assignees and pull requests — not a local CSDD task board. Product goals and prioritization are canonical in the [Linear project](https://linear.app/valenf/project/instagram-opendesign-brand-importer-c97b589cc0b2) (see [VAL-100](https://linear.app/valenf/issue/VAL-100/deliver-a-guided-workflow-from-brand-evidence-to-useful-creative-agent-context)); access may require permission. `.csdd/todo.md` is an external-tracker stub (`Mode: external` / `Tracker:` / `Next:`). Durable requirements and decisions stay in `.csdd/specs.md` and `.csdd/decisions.md`; use `.csdd/handoff.md` only for a real boundary plus concrete resumption risk. Keep private case material and outcomes local.

## Pull requests

Describe the problem, the change, and the verification performed. For changes to the OpenDesign output format, include a static example and the exact OpenDesign consumer path used to validate it.
