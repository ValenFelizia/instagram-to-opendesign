# MVP validation in OpenDesign

GitHub [#6](https://github.com/ValenFelizia/instagram-to-opendesign/issues/6) asks whether the importer improves a real design task. The first trial is a hero redesign for an existing brand with an established storefront. This protocol keeps the result inspectable and separates brand accuracy from composition quality.

## Fixed task and inputs

- Redesign only the hero below the existing header. Keep navigation and the rest of the storefront unchanged.
- Use the same objective, copy, viewport targets (desktop 1440 px and mobile 390 px), original photos, and OpenDesign version for both approaches. Do not synthesize people or products or alter their colors.
- Use the existing storefront's documented UI tokens and licensed fonts as verified constraints. Instagram-derived analysis is reviewable evidence for tone, product/material direction, and image selection. Record any conflict between the sources before generation.
- Preserve the earlier manual attempt, its prompt, assets, and screenshot as the baseline. Record which files were actually supplied; a screenshot alone cannot measure implementation effort.

## Runs

1. **Manual baseline:** inspect the existing result. Repeat it only if its original project or assets are unavailable or OpenDesign versions differ materially; record any such change.
2. **Package-assisted:** start from the same storefront and original photos. Supply the generated OpenDesign package plus a short creative objective and the verified UI constraints. Ask for one coherent visual composition and no changes outside the hero. Save the first output before requesting refinements.
3. **Diagnostic, if useful:** run the generated package without storefront constraints to see what the Instagram-only path infers. Keep this separate from the primary comparison; it tests source completeness, not the assisted workflow's design quality.

Use the same time or iteration budget for comparable runs. Record every additional prompt, manual edit, and asset preparation step. Capture desktop and mobile screenshots and keep rendered outputs locally under ignored `data/` until image rights and publication are reviewed.

## Evaluation

Review both versions side by side with the brand owner where possible. Record a short reason for each score instead of relying on a single overall preference.

| Dimension | What to inspect |
| --- | --- |
| Brand fidelity | Verified palette, typography, voice, product colors, and creator identity remain intact. |
| Composition | The visual has a deliberate hierarchy and coherent silhouette; photos do not read as unrelated floating cards. |
| Distinctiveness | The hero feels memorable and specific to this maker rather than a generic storefront layout. |
| Usability | Headline and CTA remain legible, mobile composition works, and changes stay within the hero. |
| Evidence utility | Package images, captions, and citations influenced useful decisions without promoting guesses to brand rules. |
| Effort | Time, prompt count, manual fixes, and asset preparation needed to reach a usable result. |

A brand-identity contradiction or altered product image is a critical failure regardless of aesthetic preference. Log whether a problem came from source selection, a package inference, missing asset preparation, or OpenDesign's composition choices. Decide whether the package clearly helps, helps only marginally, or makes the result worse; create focused follow-up issues from observed failures. Do not add an MCP integration before this decision.

## Felisa trial: preliminary observations

The first package-assisted run used OpenDesign `0.23.1`, a local `user:felisa-fr` design system, the existing storefront's verified UI tokens, and three original photos supplied by the owner. The agent made one first save and one final save from a single prompt. The result preserved the verified colors, Quicksand, Fer, and the bag, but its desktop composition remained close to the manual collage. At 390 px, the yarn strip covered the headline, body, and CTA, so this output failed the usability gate. The real photos were available to the OpenDesign agent and its model runtime; the photos, HTML, and screenshots remain in ignored local storage and are not included in this public report or the Git repository.

The trial also exposed a package integration defect: OpenDesign listed an installed user design system as `draft` and refused to create a project from it. The compiler now includes `metadata.json` with catalog status `published`. That status permits local selection; it does not upgrade the package's provisional brand inferences to verified facts. The package was rebuilt without provider calls and the existing 15 tests pass.

For an end-to-end check without private material, the revised synthetic `example-studio` package was copied into the isolated OpenDesign `0.23.1` user catalog, and `POST /api/projects` successfully created a project with `designSystemId: user:example-studio`.

Before another render, the OpenDesign agent proposed three different structures: product-led, material-led, and typography-led. The owner chose the product-led route. The second render used one original bag photo and produced a responsive three-column desktop hero with clean mobile ordering. It fixed the mobile overlap, but still appeared too conventional for the original editorial goal and removed Fer's portrait from the hero. This was a creative follow-up, not an equal-input comparison to the three-photo baseline. The owner rejected that second hero. The manual attempt's model and duration are unknown, so this trial cannot support a time-saved claim.

The owner rejected the second hero and deferred the hero art direction. The next validation piece is a static Instagram Story promoting the same handmade bag, with room for the owner to add Instagram's native link sticker after upload. Create two new OpenDesign projects with identical original photo, logo, font, verified site tokens, copy, and 1080 × 1920 brief. Attach the importer package to one project only. Compare readability, product fidelity, space for the native sticker, brand fit, evidence use, and correction effort. No price, stock claim, fake link control, or exact sticker coordinate is part of the artwork. Check the result in Instagram's composer before publishing because its interface can cover parts of the canvas.

### Story result

| Run | Design system | OpenDesign time | Owner response |
| --- | --- | ---: | --- |
| Manual | None | 231 seconds | Preferred: the line about Fer sits below the photo. |
| Package assisted | `user:felisa-fr` | 350 seconds | Acceptable, but not preferred. |

Both runs used one identical prompt and the same original input files. They produced similar logo, headline, product-photo, and byline arrangements. The package-assisted version made the headline more prominent and used more space below the image, but did not create a clear visual improvement. The manual agent inaccurately described the supplied PNG as transparent; the actual image is opaque. The trial supports a narrow conclusion: **for this Felisa brief, the package did not outperform a reasonable manual prompt**. It does not prove the approach lacks value for other brands or less constrained briefs. The product photo, brand typography, and exact copy were already supplied in both runs, leaving little information for the package to add.

The selected manual Story was improved after the comparison by replacing the supplied screenshot, which contained carousel dots, with the same bag's original image from Felisa's public [Bolso Multiuso product page](https://www.felisatejidos.com.ar/producto/bolso-multiuso). Its local PNG remains outside Git. That asset correction was manual work and must not be credited to the importer. The artwork intentionally has no link sticker; the owner will add one in Instagram. Actual placement and UI coverage still require a check in Instagram's composer. No Story has been posted as part of this test.

**Decision for #6:** retain the importer as a local, reviewable package workflow; do not build an MCP integration or claim an efficiency gain from these trials. The next improvement worth testing is an explicit ideation step with several genuinely different compositions and stronger asset checks before rendering, rather than more automatic identity claims.
