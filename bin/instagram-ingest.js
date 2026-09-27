#!/usr/bin/env node
import { ingest } from '../src/ingest.js';

function usage() {
  return 'Usage: node bin/instagram-ingest.js @username [--output data] [--posts 20] [--fixture path]';
}

const args = process.argv.slice(2);
const username = args.shift();
if (!username || username === '--help' || username === '-h') {
  console.log(usage());
  process.exit(username ? 0 : 1);
}
const options = {};
while (args.length) {
  const flag = args.shift();
  const value = args.shift();
  if (!value || !['--output', '--posts', '--fixture'].includes(flag)) {
    console.error(usage()); process.exit(1);
  }
  if (flag === '--output') options.outputRoot = value;
  if (flag === '--posts') options.postLimit = Number(value);
  if (flag === '--fixture') options.fixturePath = value;
}
try {
  const result = await ingest(username, options);
  console.log(`Saved ${result.source.posts.length} posts to ${result.outputDir}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
