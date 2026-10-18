// Child of install.mjs. Records a fake paid attempt intent, writes the checkpoint, then blocks until the parent kills it.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Workspace } = require('../workspace.cjs');
const { JobStore, digest } = require('../jobs.cjs');

const [workspaceRoot, projectId, checkpoint] = process.argv.slice(2);
if (!workspaceRoot || !projectId || !checkpoint) throw new Error('usage: crash-attempt.cjs <workspace> <projectId> <checkpoint>');
let jobId = null;
const workspace = new Workspace(workspaceRoot);
const store = new JobStore(path.join(workspaceRoot, 'jobs'), {
  resolveProject: id => workspace.project(id, workspace.registry().projects.find(item => item.id === id)?.status),
  fault: name => {
    if (name !== 'attempt-after-intent') return;
    const temporary = `${checkpoint}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({ jobId }));
    fs.renameSync(temporary, checkpoint);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  },
});
const scope = {
  taskId: randomUUID(),
  operation: 'report',
  provider: 'fake',
  model: 'synthetic',
  configRevision: digest({ provider: 'fake', model: 'synthetic', credential: null }),
  taskRevision: 1,
};
jobId = store.createJob(projectId, scope).id;
const authorization = store.authorize(jobId, store.job(jobId).hash);
store.dispatch(jobId, authorization, async () => { throw new Error('the fake provider must never be called'); });
