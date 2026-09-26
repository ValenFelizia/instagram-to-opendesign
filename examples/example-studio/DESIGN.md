# Example Studio — synthetic design system

> Category: Experimental

This package is a contract fixture. Its colors, typography, logo, and voice were invented for testing and must not be presented as an Instagram-derived identity.

## Visual theme

Use a calm editorial layout with warm paper surfaces and restrained green emphasis. Keep product or photographic content secondary to legible copy.

## Color roles

- **Background:** `#f7f3ec` (`--bg`).
- **Surface:** `#fffdf8` (`--surface`).
- **Text:** `#242724` (`--fg`); supporting text `#5f665e` (`--muted`).
- **Accent:** `#315a46` (`--accent`), with white foreground (`--accent-on`).
- **Border:** `#c9d0c2` (`--border`).

Use the accent for the primary action and one small supporting cue. Check contrast for each actual foreground/background pairing.

## Typography

Use Georgia for display text and Arial with system fallbacks for body text. Body text is `16px` with `1.55` leading. Display text may reach `68px` with `1.08` leading and `-0.02em` tracking. These are fixture choices, not detected fonts.

## Spacing and layout

Use a maximum content width of `1160px`. Side gutters are `36px` desktop, `24px` tablet, and `16px` phone. Section spacing is `88px`, `64px`, and `44px` respectively. Reuse the compiled spacing scale in `tokens.css`.

## Components and states

Primary controls use `--accent` and `--accent-on`; secondary controls use `--surface`, `--fg`, and `--border`. Show focus with `--focus-ring`. Error and success states use the dedicated semantic tokens, not the brand accent.

## Motion

Keep hover changes short (`--motion-fast`) and other state changes within `--motion-base`. Respect reduced-motion preferences when implementing actual components; this fixture does not ship components.

## Imagery and assets

The included SVG mark was authored for this fixture. It is not a recovered Instagram logo. Use real brand assets only after provenance and redistribution rights are checked.

## Voice

Use clear, concise copy. No tone of voice has been inferred from captions in this fixture.

## Accessibility

Use semantic controls, visible keyboard focus, and check contrast for normal and large text against their paired backgrounds. The package itself is not a WCAG conformance claim.

## Anti-patterns

Do not describe the synthetic values as verified brand facts. Do not add colors or fonts from incidental photographs as identity rules. Do not hide uncertainty when a real profile lacks evidence.
