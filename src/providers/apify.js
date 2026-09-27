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

  async run(input, limit) {
    const started = await this.request(`/actors/${encodeURIComponent(this.actor)}/runs?maxTotalChargeUsd=2`, {
      method: 'POST', body: JSON.stringify(input),
    });
    let run = started.data;
    if (!run?.id) throw new Error('Apify did not return a run ID.');
    const deadline = Date.now() + this.timeoutMs;
    while (!['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(run.status)) {
      if (Date.now() >= deadline) throw new Error(`Apify run ${run.id} did not finish within ${this.timeoutMs} ms.`);
      await sleep(this.pollMs);
      run = (await this.request(`/actor-runs/${encodeURIComponent(run.id)}`)).data;
    }
    if (run.status !== 'SUCCEEDED') throw new Error(`Apify run ${run.id} ended with ${run.status}.`);
    if (!run.defaultDatasetId) throw new Error(`Apify run ${run.id} has no dataset.`);
    const items = await this.request(`/datasets/${encodeURIComponent(run.defaultDatasetId)}/items?format=json&clean=1&limit=${limit}`);
    if (!Array.isArray(items)) throw new Error(`Apify run ${run.id} returned an invalid dataset.`);
    return { runId: run.id, items };
  }

  async collect(username, postLimit = 20) {
    const directUrls = [`https://www.instagram.com/${username}/`];
    const details = await this.run({ directUrls, resultsType: 'details', resultsLimit: 1 }, 1);
    if (!details.items[0] || details.items[0].private === true) {
      throw new Error('Profile was not found or is private. Only public profiles are supported.');
    }
    const posts = await this.run({ directUrls, resultsType: 'posts', resultsLimit: postLimit }, postLimit);
    return { profile: details.items[0], posts: posts.items, runs: [details.runId, posts.runId] };
  }
}
