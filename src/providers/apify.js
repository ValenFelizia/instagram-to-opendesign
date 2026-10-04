const API = 'https://api.apify.com/v2';
const ACTOR = 'apify~instagram-scraper';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class ApifyInstagramProvider {
  constructor({ token, fetchImpl = fetch, actor = ACTOR, pollMs = 3000, timeoutMs = 300000 } = {}) {
    if (!token) throw new Error('APIFY_TOKEN is required for live ingestion.');
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.actor = actor;
    this.pollMs = pollMs;
    this.timeoutMs = timeoutMs;
  }

  async request(path, options = {}) {
    const response = await this.fetchImpl(`${API}${path}`, {
      ...options,
      headers: {
        authorization: `Bearer ${this.token}`,
        ...(options.body ? { 'content-type': 'application/json' } : {}),
      },
      signal: AbortSignal.timeout(75000),
    });
    if (!response.ok) throw new Error(`Apify API returned HTTP ${response.status} for ${path.split('?')[0]}.`);
    return response.json();
  }

  async run(input, limit, onProviderEvent) {
    const key = input.resultsType;
    await onProviderEvent?.({ event: 'start', key, provider: 'apify', configuration: { actor: this.actor, resultsType: key } });
    const observeRun = async (run) => onProviderEvent?.({ event: 'response', key, responseId: run?.id,
      billing: Number.isFinite(run?.usageTotalUsd) ? { amount: run.usageTotalUsd, currency: 'USD', source: 'Apify actor-run usageTotalUsd' } : null });
    try {
      const started = await this.request(`/actors/${encodeURIComponent(this.actor)}/runs?maxTotalChargeUsd=2`, {
        method: 'POST', body: JSON.stringify(input),
      });
      let run = started.data;
      await observeRun(run);
      if (!run?.id) throw new Error('Apify did not return a run ID.');
      const deadline = Date.now() + this.timeoutMs;
      while (!['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(run.status)) {
        if (Date.now() >= deadline) throw new Error(`Apify run ${run.id} did not finish within ${this.timeoutMs} ms.`);
        await sleep(this.pollMs);
        run = (await this.request(`/actor-runs/${encodeURIComponent(run.id)}`)).data;
        await observeRun(run);
      }
      if (run.status !== 'SUCCEEDED') throw new Error(`Apify run ${run.id} ended with ${run.status}.`);
      if (!run.defaultDatasetId) throw new Error(`Apify run ${run.id} has no dataset.`);
      const items = await this.request(`/datasets/${encodeURIComponent(run.defaultDatasetId)}/items?format=json&clean=1&limit=${limit}`);
      if (!Array.isArray(items)) throw new Error(`Apify run ${run.id} returned an invalid dataset.`);
      await onProviderEvent?.({ event: 'end', key, status: 'completed' });
      return { runId: run.id, items };
    } catch (error) { await onProviderEvent?.({ event: 'end', key, status: 'failed' }); throw error; }
  }

  async collect(username, postLimit = 20, { onProviderEvent, fetchImpl } = {}) {
    const collector = fetchImpl ? new ApifyInstagramProvider({ ...this, fetchImpl }) : this;
    const directUrls = [`https://www.instagram.com/${username}/`];
    const details = await collector.run({ directUrls, resultsType: 'details', resultsLimit: 1 }, 1, onProviderEvent);
    if (!details.items[0] || details.items[0].private === true) {
      throw new Error('Profile was not found or is private. Only public profiles are supported.');
    }
    const posts = await collector.run({ directUrls, resultsType: 'posts', resultsLimit: postLimit }, postLimit, onProviderEvent);
    return { profile: details.items[0], posts: posts.items, runs: [details.runId, posts.runId] };
  }
}
