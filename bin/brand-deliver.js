#!/usr/bin/env node
import { deliver, verifyCatalog } from '../src/delivery.js';
const args = process.argv.slice(2);
const usage = 'Usage: pnpm brand:deliver <profile-dir> --package <dir> --brief <dir> --od-data-dir <absolute-dir> --od-root <installation-dir> [--replace] [--daemon-url <loopback-origin> --workspace-id <id> --workspace-member-id <id>]\n       pnpm brand:deliver --verify <delivery-dir> --daemon-url <loopback-origin> [--workspace-id <id> --workspace-member-id <id>]';
function flags(values, names, allowReplace = false) {
  const options = {};
  for (let i = 0; i < values.length; i++) {
    if (values[i] === '--replace' && allowReplace && !options.replace) { options.replace = true; continue; }
    const key = names[values[i]];
    if (!key || options[key] || !values[i + 1] || values[i + 1].startsWith('--')) throw new Error(usage);
    options[key] = values[++i];
  }
  // Never accept secrets as command-line flags or include them in the receipt.
  if (process.env.OD_API_TOKEN) options.apiToken = process.env.OD_API_TOKEN;
  return options;
}
const connection = { '--daemon-url': 'daemonUrl', '--workspace-id': 'workspaceId', '--workspace-member-id': 'workspaceMemberId' };
try {
  let result;
  if (args[0] === '--verify') {
    if (!args[1] || args[1].startsWith('-')) throw new Error(usage);
    const options = flags(args.slice(2), connection);
    if (!options.daemonUrl) throw new Error(usage);
    result = await verifyCatalog(args[1], options.daemonUrl, options);
  } else {
    const [profile, ...values] = args;
    const names = { '--package': 'packageDir', '--brief': 'briefDir', '--od-data-dir': 'odDataDir', '--od-root': 'odRoot', ...connection };
    if (!profile || profile.startsWith('-')) throw new Error(usage);
    const options = flags(values, names, true);
    result = await deliver(profile, options);
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
