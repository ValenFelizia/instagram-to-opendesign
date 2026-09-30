import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { compileBrief, importDirections, prepareBrief, suggestDirections, validateDirections, validateRequest } from '../src/brief.js';
import { requestCreativeDirections } from '../src/providers/openai-directions.js';
import { briefFixture, fixtureDirections } from './helpers/brief.js';

test('hero and Story briefs preserve copy, bundle local evidence and execute only a selected distinct direction', async () => {
  for (const kind of ['web-hero', 'instagram-story']) {
    const fixture = await briefFixture(kind);
    try {
      const { context } = await prepareBrief(fixture.root);
      await importDirections(fixture.root, { directions: fixtureDirections(context) });
      let built = await compileBrief(fixture.root);
      assert.equal(built.brief.status, 'needs-review'); assert.equal(built.brief.selectedDirection, null);
      fixture.request.selectedDirectionId = 'D-1';
      await writeFile(path.join(fixture.root, 'design-request.json'), JSON.stringify(fixture.request));
      built = await compileBrief(fixture.root);
      assert.equal(built.brief.status, 'ready-for-execution');
      assert.equal(built.brief.assets.length, 1); assert.equal(built.brief.directions.length, 3);
      assert.deepEqual(built.brief.request.copy, fixture.request.copy);
      for (const item of [...built.brief.assets.map((asset) => ({ sourcePath: asset.path })), ...built.brief.evidence,
        ...built.brief.sources.map((source) => ({ sourcePath: source.path }))]) assert.equal((await stat(path.join(built.outputDir, item.sourcePath))).isFile(), true);
      const markdown = await readFile(path.join(built.outputDir, 'BRIEF.md'), 'utf8');
      assert.match(markdown, /Exact approved copy/); assert.match(markdown, /unselected.*D-2|D-2.*unselected/);
      assert.match(markdown, kind === 'web-hero' ? /1440 px and 390 px/ : /1080 × 1920/);
      if (kind === 'instagram-story') assert.match(markdown, /Do not draw a fake/);
      const bad = structuredClone(fixture.request); bad.action.type = kind === 'instagram-story' ? 'link' : 'native-sticker';
      assert.throws(() => validateRequest(bad, 'example_studio'), /static Story|only to Stories/);
    } finally { await rm(fixture.root, { recursive: true, force: true }); }
  }
});

test('explicit creative generation reuses paid cache, compilation makes no calls; stale and invalid proposals preserve outputs', async () => {
  const fixture = await briefFixture();
  try {
    let calls = 0;
    const provider = async (context) => { calls++; return { directions: fixtureDirections(context) }; };
    assert.equal((await suggestDirections(fixture.root, { provider })).reused, false);
    assert.equal((await suggestDirections(fixture.root, { provider })).reused, true);
    fixture.request.selectedDirectionId = 'D-1';
    await writeFile(path.join(fixture.root, 'design-request.json'), JSON.stringify(fixture.request));
    const built = await compileBrief(fixture.root);
    assert.equal((await suggestDirections(fixture.root, { provider })).reused, true); assert.equal(calls, 1);
    const oldJson = await readFile(path.join(built.outputDir, 'design-brief.json'), 'utf8');
    const oldMarkdown = await readFile(path.join(built.outputDir, 'BRIEF.md'), 'utf8');
    const oldCache = await readFile(path.join(fixture.root, 'creative-directions.json'), 'utf8');
    await assert.rejects(() => suggestDirections(fixture.root, { force: true, provider: async (context) => {
      const directions = fixtureDirections(context); directions[0].evidenceIds = ['E-FAKE']; return { directions };
    } }), /Unknown direction evidence/);
    assert.equal(await readFile(path.join(fixture.root, 'creative-directions.json'), 'utf8'), oldCache);
    fixture.request.selectedDirectionId = 'D-FAKE';
    await writeFile(path.join(fixture.root, 'design-request.json'), JSON.stringify(fixture.request));
    await assert.rejects(() => compileBrief(fixture.root), /Selected direction/);
    fixture.request.selectedDirectionId = 'D-1'; fixture.request.objective += ' Changed.';
    await writeFile(path.join(fixture.root, 'design-request.json'), JSON.stringify(fixture.request));
    await assert.rejects(() => compileBrief(fixture.root), /missing or stale/);
    assert.equal(await readFile(path.join(built.outputDir, 'design-brief.json'), 'utf8'), oldJson);
    assert.equal(await readFile(path.join(built.outputDir, 'BRIEF.md'), 'utf8'), oldMarkdown);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('copy conflicts, alt/crop review and missing confirmation prevent execution; unresolved rights fail before a provider', async () => {
  const fixture = await briefFixture();
  try {
    fixture.decisions.rules.push({ id: 'R-HEADLINE', kind: 'copy', target: 'headline', value: 'Owner-approved different text.', sourceId: 'S-REQUEST' });
    await writeFile(path.join(fixture.root, 'brand-decisions.json'), JSON.stringify(fixture.decisions));
    fixture.request.selectedDirectionId = 'D-1'; fixture.request.assets[1].fit = 'cover'; fixture.request.assets[1].alt.usage = 'unknown';
    fixture.request.sourceId = null;
    await writeFile(path.join(fixture.root, 'design-request.json'), JSON.stringify(fixture.request));
    const state = await prepareBrief(fixture.root);
    assert.ok(state.blockers.some((item) => item.includes('copy conflict')));
    assert.ok(state.blockers.some((item) => item.includes('Review crop')));
    assert.ok(state.blockers.some((item) => item.includes('alternative')));
    await importDirections(fixture.root, { directions: fixtureDirections(state.context) });
    assert.equal((await compileBrief(fixture.root)).brief.status, 'needs-review');
    let calls = 0;
    await assert.rejects(() => suggestDirections(fixture.root, { provider: async () => { calls++; } }), /Resolve the request/);
    assert.equal(calls, 0);
    fixture.review.entries[1].permission = { use: 'unknown' };
    await writeFile(path.join(fixture.root, 'asset-review.json'), JSON.stringify(fixture.review));
    await assert.rejects(() => suggestDirections(fixture.root, { provider: async () => { calls++; } }), /not approved/);
    assert.equal(calls, 0);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('color-only alternatives, unknown assets and direction/treatment conflicts are rejected; output cannot replace a profile', async () => {
  const fixture = await briefFixture();
  try {
    const { context } = await prepareBrief(fixture.root);
    const directions = fixtureDirections(context);
    const duplicates = structuredClone(directions); duplicates[1].layout = duplicates[0].layout;
    assert.throws(() => validateDirections(duplicates, context), /alternatives must differ/);
    const invented = structuredClone(directions); invented[0].assetIds = ['A-FAKE'];
    assert.throws(() => validateDirections(invented, context), /Unknown or unselected/);
    const wrongCount = structuredClone(directions); wrongCount[2].assetIds.pop();
    assert.throws(() => validateDirections(wrongCount, context), /Asset count conflicts/);
    await importDirections(fixture.root, { directions });
    await assert.rejects(() => compileBrief(fixture.root, { outputDir: fixture.root }), /separate directory/);
    await assert.rejects(() => compileBrief(fixture.root, { outputDir: path.join(fixture.root, 'manual') }), /separate directory/);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('direction provider uses text-only strict Responses JSON and handles refusal/incomplete output', async () => {
  const fixture = await briefFixture();
  try {
    const { context } = await prepareBrief(fixture.root);
    const result = await requestCreativeDirections(context, { token: 'synthetic-key', fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      const body = JSON.parse(options.body); assert.equal(body.text.format.strict, true); assert.equal(body.store, false);
      assert.equal(body.input[1].content, JSON.stringify(context)); assert.ok(!options.body.includes('input_image'));
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ directions: fixtureDirections(context) }) }] }] });
    } });
    assert.equal(result.directions.length, 3);
    for (const payload of [{ status: 'incomplete' }, { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }]) {
      await assert.rejects(() => requestCreativeDirections(context, { token: 'synthetic-key', fetchImpl: async () => Response.json(payload) }), /incomplete|refused/);
    }
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});
