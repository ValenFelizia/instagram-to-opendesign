#!/usr/bin/env node
import { deliver, verifyCatalog } from '../src/delivery.js';
const args = process.argv.slice(2);
const usage = 'Usage: pnpm brand:deliver <profile-dir> --package <dir> --brief <dir> --od-data-dir <absolute-dir> --od-root <installation-dir> [--replace]\n       pnpm brand:deliver --verify <delivery-dir> --daemon-url http://127.0.0.1:7456';
try {
  let result;
  if (args[0] === '--verify') {
    if (args.length !== 4 || args[2] !== '--daemon-url') throw new Error(usage);
    result = await verifyCatalog(args[1], args[3]);
  } else {
    const [profile, ...flags] = args, options = {};
    const names = { '--package': 'packageDir', '--brief': 'briefDir', '--od-data-dir': 'odDataDir', '--od-root': 'odRoot' };
    if (!profile || profile.startsWith('-')) throw new Error(usage);
    for (let i = 0; i < flags.length; i++) {
      if (flags[i] === '--replace' && !options.replace) { options.replace = true; continue; }
      const key = names[flags[i]];
      if (!key || options[key] || !flags[i + 1] || flags[i + 1].startsWith('--')) throw new Error(usage);
      options[key] = flags[++i];
    }
    result = await deliver(profile, options);
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
