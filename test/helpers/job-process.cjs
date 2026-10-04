const fs = require('node:fs');
const path = require('node:path');
const { Workspace } = require('../../desktop/workspace.cjs');
const { JobStore } = require('../../desktop/jobs.cjs');
const root = process.argv[2], mode = process.argv[3], point = process.argv[4];
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixture.json')));
const workspace = new Workspace(path.join(root, 'workspace'));
let armed = false;
function checkpoint() {
  fs.writeFileSync(path.join(root, 'checkpoint.txt'), 'ready');
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
}
const store = new JobStore(path.join(root, 'jobs'), {
  resolveProject: id => workspace.project(id),
  fault: name => { if (armed && name === point) checkpoint(); }
});
if (mode === 'hold') checkpoint();
else {
  const scope = { ...fixture.scope, taskRevision: 2, provider: mode === 'dispatch' ? 'fake' : 'local' };
  const job = store.createJob(fixture.project, scope), authorization = store.authorize(job.id, job.planHash);
  fs.writeFileSync(path.join(root, 'new-job.txt'), job.id);
  armed = true;
  if (mode === 'dispatch') store.dispatch(job.id, authorization, () => {
    fs.writeFileSync(path.join(root, 'remote-call.txt'), 'one call');
    return { remoteId: 'synthetic-request' };
  }).catch(() => process.exit(2));
  else store.complete(job.id, authorization, payload => fs.writeFileSync(path.join(payload, 'result.txt'), 'second'), () => true);
}
