# Guided onboarding prototype

Open `index.html` in a modern browser. No installation, server, framework or API key is required. The interface is in Spanish, matching the default report language. This is a synthetic, local interaction prototype for [GitHub issue 43](https://github.com/ValenFelizia/instagram-to-opendesign/issues/43) / VAL-104, not the implemented app.

## Suggested walkthrough

1. Enter `https://www.instagram.com/example_studio/`. Any valid profile URL exercises validation but always opens the same fictional **Taller Nube** fixture; the URL is neither requested nor persisted.
2. Complete settings with `demo-apify` and `demo-openai`, or use **Completar con ejemplos**. Do not enter real credentials. Confirm the local simulation.
3. Return to the home view while the simulation runs. Reopen the project when its three images need classification.
4. Classify the mark as identity and the two objects as product images. Continue and open the completed dossier.
5. Inspect a signal's evidence. Technical IDs are available inside a second disclosure, rather than in the main reading flow.
6. Review the palette as a proposal and simulated image permissions, or leave them pending. Choose a Story, promotional image, conceptual landing or existing-site change.
7. An existing-site change needs a **fictional** linked folder. Download the example context to inspect its pending decisions and scope.

**Explorar estados** provides shortcuts for first use, configured settings, active processing, image review, cached dossier, stale sources, recoverable failure and interruption. Each shortcut resets the synthetic choices. The same sidebar project represents each scenario; this is not a multi-project implementation.

## Local state and boundaries

- Classic browser scripts and bundled SVG illustrations work over `file://`. The content security policy forbids network connections. There are no provider calls, external fonts, analytics or real profile assets.
- The browser saves only whitelisted synthetic flags and choices under `brand-onboarding-synthetic-v1`. Credentials, entered profile URLs and arbitrary text are not stored. Demo credentials clear when settings close.
- Leaving a view keeps the timer running in the same live tab. Reloading/closing interrupts it; reopening shows the last saved phase and requires explicit resume. Browser storage availability and eviction remain browser-controlled. This does not implement durable jobs or secure credential storage.
- The dossier is authored fixture content, not recomputed model output. Image classifications update the selected visual list, not the fictional inference prose. Permissions and proposal acceptance are simulated, never confirmed brand authority.
- The download is one illustrative Markdown file. It does not include images, satisfy the current canonical brief schema, invoke the real exporter, execute a design task or approve publication. Current core gates are unchanged.

Read the [screen/core map and product questions](../../docs/onboarding-prototype.md) before integrating this with real data.

## Verification

State/storage tests are included in the normal `pnpm test` suite. The optional browser script requires an operator-supplied Playwright installation and a locally installed browser:

```powershell
# If Playwright is not resolvable from this checkout, specify its existing package directory.
$env:PLAYWRIGHT_MODULE = 'C:\path\to\existing\node_modules\playwright'
$env:BROWSER_CHANNEL = 'msedge' # Or omit for an installed Playwright Chromium.
node prototypes/onboarding/verify-browser.mjs
```

The script makes no HTTP(S) requests and saves synthetic screenshots/results in Git-ignored `tmp/onboarding-qa/`. It exercises invalid input, keyboard/focus recovery, configuration reuse, review pause, task changes, limited download, stale input, explicit retry and reopen/resume. Review screenshots independently; an automated pass is not visual acceptance or full accessibility conformance.
