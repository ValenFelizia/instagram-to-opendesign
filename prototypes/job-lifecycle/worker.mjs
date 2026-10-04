// Stand-in Node worker; messages only drive synthetic checkpoints.
import { append } from './store.mjs';

const root = process.argv[2];
if (!root || !process.send) throw new Error('SPIKE_REQUIRES_TEST_HARNESS');
let writes = Promise.resolve();
process.on('message', message => {
  writes = writes.then(async () => {
    const kind = message.kind === 'exit' ? 'interrupted' : message.kind;
    try {
      const state = await append(root, kind);
      process.send({ requestId: message.requestId, status: state.status });
      if (message.kind === 'exit') process.disconnect();
    } catch { process.send({ requestId: message.requestId, error: 'SPIKE_EVENT_REJECTED' }); }
  });
});
process.send({ ready: true });
