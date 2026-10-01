import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { profileFixture } from './profile.js';
import { emptyDecisions } from '../../src/decisions.js';
import { initializeAssets } from '../../src/asset-catalog.js';
import { digest } from '../../src/local.js';
import { emptyRequest } from '../../src/brief.js';

export async function briefFixture(kind = 'web-hero') {
  const fixture = await profileFixture();
  const decisions = await emptyDecisions(fixture.prepared, fixture.analysis);
  const text = 'Synthetic owner approves fixture assets for local design, request, audience, exact copy and action. This is not a real brand approval.';
  await writeFile(path.join(fixture.root, 'manual/request.md'), text);
  decisions.sources.push({ id: 'S-REQUEST', path: 'manual/request.md', sha256: digest(text),
    reviewer: 'Synthetic owner', reviewedAt: '2026-01-02T00:00:00Z', summary: 'Synthetic request and permission' });
  await writeFile(path.join(fixture.root, 'brand-decisions.json'), JSON.stringify(decisions));
  const review = await initializeAssets(fixture.prepared);
  for (const entry of review.entries) Object.assign(entry, { origin: 'original', uiOverlay: false,
    permission: { use: 'local-design', sourceId: 'S-REQUEST' } });
  await writeFile(path.join(fixture.root, 'asset-review.json'), JSON.stringify(review));
  const request = emptyRequest('example_studio', kind);
  Object.assign(request, { objective: 'Introduce a synthetic handcrafted bag', audience: 'People who value careful craft', sourceId: 'S-REQUEST',
    copy: [{ id: 'brand', text: 'Example Studio' }, { id: 'headline', text: 'Made carefully.' }, { id: 'body', text: 'A synthetic product for a test.' }],
    constraints: ['Use only supplied copy and images.'],
    assets: review.entries.map((entry) => ({ id: entry.id, fit: 'contain', cropReviewed: false, lowResolutionAccepted: true,
      alt: { usage: 'informative', text: entry.role === 'logo' ? 'Synthetic logo' : 'Synthetic product image' } })) });
  request.action = kind === 'web-hero' ? { type: 'link', label: 'Explore', url: 'https://example.com/', reservedSpace: null }
    : { type: 'native-sticker', label: 'Explore', url: 'https://example.com/', reservedSpace: { x: .15, y: .82, width: .7, height: .08 } };
  await writeFile(path.join(fixture.root, 'design-request.json'), JSON.stringify(request));
  return { ...fixture, request, review, decisions };
}

export function fixtureDirections(context) {
  const ids = context.assets.map((entry) => entry.id);
  return [
    { id: 'D-1', label: 'Product clarity', layout: 'split', hierarchy: 'headline-first', assetTreatment: 'single-contained', assetIds: [ids[1]],
      evidenceIds: [ids[1]], rationale: 'A product photo supports a focused product panel.', limits: ['Unproven creative effectiveness.'], missingInformation: [] },
    { id: 'D-2', label: 'Image field', layout: 'editorial', hierarchy: 'image-first', assetTreatment: 'single-field', assetIds: [ids[1]],
      evidenceIds: [ids[1]], rationale: 'The same product supports a stronger visual opening.', limits: ['Text stays separate from the photo.'], missingInformation: [] },
    { id: 'D-3', label: 'Mark and product', layout: 'framed', hierarchy: 'brand-first', assetTreatment: 'paired', assetIds: ids,
      evidenceIds: ids, rationale: 'The logo and product remain separate sources.', limits: ['The logo does not establish a verified font.'], missingInformation: [] },
  ];
}
