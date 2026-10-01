# Accessibility preflight

An optional `accessibility` object in the design request declares actual color usage. It participates in the creative-context hash; changes invalidate previous directions.

```json
{"pairs":[{"id":"body","usage":"normal-text","foreground":"var(--fg)","background":"var(--bg)"}],"motion":false}
```

Use `normal-text` for 4.5:1, `large-text` for 3:1 only after confirming the rendered size/weight qualifies, and `control` for essential control boundaries/icons at 3:1 against their adjacent background. These are declared-use checks, not a compliance certificate. Sources: [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

Local brief compilation checks confirmed token overrides and literal six-digit colors. Unresolved/default tokens remain manual until checked against the compiled package:

```powershell
pnpm brand:accessibility brand-output/example-studio data/example_studio/brief/web-hero/design-brief.json
```

The command writes Spanish `ACCESSIBILITY.md` and structured `accessibility.json`; `--lang en` writes English prose. Exit 2 means a verifiable failure; exit 1 means invalid input. Package installation rechecks current tokens independently, so editing the report cannot bypass a failure. Unknown usage, photograph/gradient backgrounds, unresolved/circular aliases and contextual image purposes never pass automatically. The report offers foreground candidates without changing confirmed brand colors.

Briefs carry verifiable failures as input blockers. Manual checks remain acceptance tasks: keyboard operation, unobscured focus, names/semantics and reading order, 200% text resize and 320 px reflow, contextual alternatives, reduced motion when proposed, and artwork transcripts. Story sticker placement/destination requires Instagram composer review. Follow the [W3C image decision tree](https://www.w3.org/WAI/tutorials/images/decision-tree/) for image purpose. Rendering and human review remain required even when all declared color pairs pass.
