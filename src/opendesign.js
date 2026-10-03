import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

// These are inspected catalog contracts, not a permissive version range.
export async function openDesignInstallation(root) {
  const source = await optionalJson(path.join(root, 'apps/daemon/package.json'));
  if (source) {
    if (source.version !== '0.23.1') throw new Error(`OpenDesign ${source.version} is not verified; tested source layout: 0.23.1.`);
    return { version: source.version, layout: 'source' };
  }
  const app = await optionalJson(path.join(root, 'resources/app/package.json'));
  const config = await optionalJson(path.join(root, 'resources/open-design-config.json'));
  if (app?.name !== 'open-design-packaged-app' || app.version !== '0.24.1' || config?.appVersion !== app.version ||
      app.dependencies?.['@open-design/contracts'] !== '0.23.1') {
    throw new Error('Unsupported OpenDesign installation. Supply a 0.23.1 source root or the inspected 0.24.1 desktop payload root (containing resources/app/package.json).');
  }
  for (const name of ['daemonSidecarEntryRelative', 'daemonCliEntryRelative']) {
    const relative = config[name];
    if (typeof relative !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(relative) || relative.split('/').includes('..') ||
        !(await stat(path.join(root, 'resources', relative))).isFile()) throw new Error('Packaged OpenDesign daemon entries are missing or unsafe.');
  }
  return { version: app.version, layout: 'desktop' };
}

async function optionalJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export function localDaemonUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Supply an explicit loopback HTTP daemon origin without credentials, paths or query parameters.');
  }
  return url;
}

export function workspaceHeaders({ workspaceId, workspaceMemberId, apiToken } = {}) {
  const pair = [workspaceId, workspaceMemberId];
  if (pair.some(Boolean) && !pair.every((item) => typeof item === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(item))) {
    throw new Error('Supply both explicit workspace ID and workspace member ID.');
  }
  return { ...(workspaceId ? { 'x-od-workspace-id': workspaceId, 'x-od-workspace-member-id': workspaceMemberId } : {}),
    ...(apiToken ? { authorization: `Bearer ${apiToken}` } : {}) };
}

export function daemonClient(daemonUrl, options = {}) {
  const origin = localDaemonUrl(daemonUrl);
  const headers = workspaceHeaders(options);
  const fetchImpl = options.fetchImpl ?? fetch;
  return async (route, { method = 'GET', body } = {}) => {
    const response = await fetchImpl(new URL(route, origin), { method, headers: { ...headers, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`OpenDesign local ${method} returned ${response.status}; check daemon, destination and workspace permissions.`);
    return response.json();
  };
}

export async function desktopAuthority(client, installation, scope) {
  const health = await client('/api/health');
  if (health.version !== installation.version) throw new Error('Daemon version differs from the inspected OpenDesign installation.');
  const { context } = await client('/api/workspace/context');
  if (context?.workspaceId !== scope.workspaceId || context?.workspaceMemberId !== scope.workspaceMemberId) {
    throw new Error('Daemon workspace authority differs from the explicitly supplied workspace/member.');
  }
}
