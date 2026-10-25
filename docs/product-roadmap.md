# Product roadmap

This is the shape of the thing, not a task list. It holds the few big moves worth making and the rules that constrain them. Day-to-day work is in [GitHub Issues](https://github.com/ValenFelizia/instagram-to-opendesign/issues); product priority is in [Linear](https://linear.app/valenf/issue/VAL-100/deliver-a-guided-workflow-from-brand-evidence-to-useful-creative-agent-context). When a spike is understood well enough to split, it becomes issues and leaves this page.

No dates. A spike that needs a date is not a spike.

## The bet

A person with a real brand, a real product and a real task should not have to rebuild their brand from scattered material every time they talk to a creative agent. If this tool can turn that material into context an agent can act on — and show its work while doing it — it is worth the effort.

Everything below either tests that bet or refuses to assume it.

## Rules that do not move

- **The core is consumer-neutral.** Decisions, request, brief, hashes and acceptance tasks are canonical before a recipient is chosen. A renderer's fixed slots must not decide which brand facts survive ([DEC-009](../.csdd/decisions.md)). `evals/consumer-neutral-core/` enforces this.
- **No new source and no new adapter until one real person closes the loop once.** Breadth before depth is how this kind of tool becomes a demo that impresses nobody who has a real job.
- **Private by default.** A real case lives in `evals/private/` and never in public documentation ([DEC-017](../.csdd/decisions.md)).
- **Claims need evidence.** A verified inventory, a green test and a pretty render are three different things. Comparative savings and general utility need a matched run, and the roadmap does not assume one will happen.
- **Honest status.** No installer, no npm package, no release, no general-utility verdict. When that changes, it changes because a spike closed, not because a page needed a slogan.

## Horizon 1 — Make it true for one person

The tool is currently true for its author. This horizon removes that asterisk.

### S1. Close the loop with a real brand, without rescuing it

**Question.** Can a technical operator go from a profile to an agent-ready folder and a delivered piece without the author in the room?

**Done when.** One person, one brand, one finished piece, no manual file surgery and no undocumented step. The private case is the natural candidate.

**Not promised.** Growth, a second user, or that the piece is good. This spike proves the path exists, not that it is pleasant.

### S2. Prove the app on real hardware

**Question.** Does the Windows app survive a real install on a machine that is not the development box?

**Done when.** The manual acceptance rows in [#70](https://github.com/ValenFelizia/instagram-to-opendesign/issues/70) are verified on Windows 10 and 11 with a live provider run, or are explicitly retired as not worth verifying.

**Not promised.** A release, code signing or an auto-updater. Install support is already declared; this spike only checks that the declaration is true.

### S3. Decide what the first release is

**Question.** Is this a tool the author uses, a tool a stranger can install, or a product with a support promise?

**Done when.** The answer is recorded as a decision, with the distribution path it implies.

**Not promised.** That the answer is "release". "Keep it a local tool" is a valid outcome and probably the honest one until S1 and S2 close.

## Horizon 2 — Make it true for someone else

Only after Horizon 1. Each spike here answers a question that Horizon 1 will make askable.

### S4. A second source

**Question.** What does a second source teach about the core that Instagram could not?

**Done when.** A second source exercises the same canonical preparation without special cases leaking into the core.

**Not promised.** Universal scraping, a source marketplace, or support for whatever is popular next month. One second source is a test of the boundary, not a coverage target.

### S5. A second recipient

**Question.** Does the handoff serve an agent that is not OpenDesign, without the core knowing which one it is?

**Done when.** A different agent consumes the folder and the core is unchanged by it. The synthetic case already proves the folder is neutral; this proves a real recipient can use it.

**Not promised.** A plugin system or a vendor matrix. If a second recipient needs adapter work, that is a finding, not a feature.

### S6. Someone else can start alone

**Question.** Can a person who is not the author install this, read the docs and reach a first useful result without a call?

**Done when.** One such person does it, and the friction they hit becomes issues.

**Not promised.** A funnel, a landing page or onboarding analytics. This spike is about whether the documentation is true, not about conversion.

## Horizon 3 — Decide what it becomes

### S7. Naming and positioning

**Question.** Do the repository, package, CLI and schema names still describe the product after Horizons 1 and 2?

**Done when.** A naming decision is recorded, or the current names are explicitly kept.

**Not promised.** A rebrand. Current names stay until a decision says otherwise, and compatibility is a real cost.

### S8. Whatever the evals say

**Question.** What does the accumulated record of real cases say the next big move should be?

**Done when.** This page is rewritten from evidence instead of intention.

This spike is deliberately empty. It exists so the roadmap has a place to change its mind.

## Not on this roadmap

Hosted SaaS and accounts. Cloud synchronization. MCP. Telemetry by default. A universal vendor-compatibility promise. Automatic publication. New social sources beyond the one that S4 tests. These are not deferred with a date; they are out of scope until something in Horizon 1 or 2 makes them the obvious next move.

## How this page changes

A spike splits when it is understood: its parts become issues with acceptance criteria, and the spike leaves this page. A spike that keeps not happening for a year is either wrong or not wanted, and should be deleted rather than carried.

The record of what already happened lives in [the verification checkpoint](verification-checkpoint.md), [the app implementation sequence](app-implementation.md) and the [eval outcomes](../evals/consumer-neutral-core/outcome.md). This page is only about what is next.
