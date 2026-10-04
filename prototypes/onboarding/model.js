/* Browser-safe prototype state. No credentials, real profile URLs or free text are persisted. */
(() => {
  const views = ['home', 'progress', 'evidence', 'report', 'review', 'actions', 'handoff'];
  const statuses = ['empty', 'running', 'review-required', 'ready', 'failed', 'interrupted', 'stale'];
  const tasks = ['later', 'instagram-story', 'promotional-image', 'conceptual-landing', 'website-change'];
  const classifications = ['brand-graphic', 'product-photo', 'excluded'];
  const initial = () => ({ version: 1, configured: false, view: 'home', status: 'empty', phase: 0,
    objective: 'later', task: 'instagram-story', images: [null, null, null], palette: 'pending', rights: 'pending', site: false });
  function profile(value) {
    let url;
    try { url = new URL(value.trim()); } catch { return null; }
    if (!['https:', 'http:'].includes(url.protocol) || !['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase()) || url.username || url.password) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 1 || !/^[a-z0-9._]{1,30}$/i.test(parts[0]) || ['p', 'reel', 'reels', 'stories', 'accounts', 'explore', 'direct'].includes(parts[0].toLowerCase())) return null;
    return parts[0].toLowerCase();
  }
  function snapshot(input) {
    const state = initial();
    state.configured = input.configured === true;
    state.view = views.includes(input.view) ? input.view : 'home';
    state.status = statuses.includes(input.status) ? input.status : 'empty';
    state.phase = Number.isInteger(input.phase) && input.phase >= 0 && input.phase <= 4 ? input.phase : 0;
    state.objective = tasks.includes(input.objective) ? input.objective : 'later';
    state.task = tasks.includes(input.task) && input.task !== 'later' ? input.task : 'instagram-story';
    state.images = [0, 1, 2].map(index => classifications.includes(input.images?.[index]) ? input.images[index] : null);
    state.palette = ['pending', 'proposal', 'rejected'].includes(input.palette) ? input.palette : 'pending';
    state.rights = input.rights === 'demo-permitted' ? 'demo-permitted' : 'pending';
    state.site = input.site === true;
    return state;
  }
  function restore(raw) {
    let state;
    try { const parsed = JSON.parse(raw); state = parsed?.version === 1 ? snapshot(parsed) : initial(); }
    catch { state = initial(); }
    if (state.status === 'running') { state.status = 'interrupted'; state.view = 'progress'; }
    return state;
  }
  globalThis.OnboardingPrototype = Object.freeze({ initial, profile, snapshot, restore });
})();
