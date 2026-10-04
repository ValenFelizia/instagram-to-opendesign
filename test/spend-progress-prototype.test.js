import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { createRunRecord, runEffortEvents } from '../src/run-record.js';

const context=vm.createContext({});
vm.runInContext(await readFile(new URL('../prototypes/spend-progress/model.js',import.meta.url),'utf8'),context);
const M=context.SpendProgress, plain=value=>JSON.parse(JSON.stringify(value));
const count=state=>M.ledger(state.records).attemptCount;

test('new paid scope requires consent; cancel/reopen/restart and stale scope never dispatch',()=>{
  const state=M.create('fresh');
  assert.equal(state.plan.calls,2); assert.equal(state.plan.estimate,null);
  assert.throws(()=>M.start(state),/AUTHORIZATION_REQUIRED/);
  for(const action of ['leave','reopen','restart']) assert.equal(count(M.change(state,action)),0);
  const changed=M.change(state,'inputs-changed');
  assert.equal(changed.plan.revision,state.plan.revision);
  assert.throws(()=>M.start(changed,state.plan.revision),/NOT_READY/);
  const reviewed=M.change(changed,'review-inputs');
  assert.equal(reviewed.plan.revision,2);
  assert.throws(()=>M.start(reviewed,1),/AUTHORIZATION_REQUIRED/);
  assert.equal(count(reviewed),0);
});

test('local cache reuse preserves earlier bills without adding provider attempts',()=>{
  const state=M.create('cached'), before=plain(M.ledger(state.records));
  const started=M.start(state), completed=M.change(started,'response');
  assert.equal(started.job.status,'running'); assert.equal(completed.job.status,'completed');
  assert.deepEqual(plain(M.ledger(completed.records)),before);
  assert.equal(M.timeline(completed).find(p=>p.name==='analysis').mode,'cache');
  assert.equal(completed.plan.paid,false);
});

test('missing invoices are null and returned zero/tiny positive amounts retain their meaning',()=>{
  const state=M.create('missing'), summary=M.ledger(state.records);
  assert.equal(summary.unknownBilling,1); assert.equal(summary.partial,true);
  assert.equal(summary.observations[1].billing,null);
  assert.equal(summary.observations[1].usage.input_tokens,800);
  const records=plain(state.records);
  records[0].phases[0].attempts[0].billing.amount=0;
  assert.equal(M.ledger(records).byCurrency.USD,0);
  records[0].phases[0].attempts[0].billing.amount=.000000004;
  assert.notEqual(M.money(M.ledger(records).byCurrency.USD),'0');
  assert.equal(M.ledger(records).unknownBilling,1);
});

test('shared tasks and repeated identical records count each attempt once, including usage subsets',()=>{
  const state=M.create('shared'), before=plain(M.ledger(state.records));
  assert.equal(state.tasks.length,2);
  assert.deepEqual(plain(M.ledger([...state.records,...state.records])),before);
  assert.equal(before.byCurrency.USD,.35);
  assert.equal(before.usageByModel['openai/synthetic-vision-model'].input,1600);
  assert.equal(before.usageByModel['openai/synthetic-vision-model'].output,480);
  const reordered=plain(state.records);
  reordered[0].phases[0].attempts[0].billing={source:'synthetic-provider-observation',currency:'USD',amount:.15};
  assert.deepEqual(plain(M.ledger([...state.records,...reordered])),before);
});

test('mixed currencies are separate and conflicting IDs/malformed amounts reject aggregation',()=>{
  const state=M.create('mixed');
  assert.deepEqual(plain(M.ledger(state.records).byCurrency),{USD:.18,EUR:.12});
  const changed=plain(state.records); changed[0].phases[0].attempts[0].billing.amount=99;
  assert.throws(()=>M.ledger([...state.records,...changed]),/CONFLICTING_OBSERVATION/);
  for(const amount of [-1,Infinity,NaN]) {
    const records=plain(state.records);records[0].phases[0].attempts[0].billing.amount=amount;
    assert.throws(()=>M.ledger(records),/INVALID_BILLING/);
  }
  const records=plain(state.records);records[0].phases[2].attempts[0].usage.input_tokens_details.cached_tokens='<img>';
  assert.throws(()=>M.ledger(records),/INVALID_USAGE/);
});

test('response lookup keeps the same attempt; later colors require a distinct new scoped authorization',()=>{
  const state=M.create('interrupted'), before=count(state);
  assert.equal(M.recoveryPlan(state).calls,1);
  assert.equal(count(M.change(state,'restart')),before);
  const restored=M.change(state,'reconcile');
  assert.equal(restored.job.status,'review-required'); // Not overall completion.
  assert.equal(count(restored),before);
  assert.equal(M.latest(restored).phases[2].attempts[0].id,M.latest(state).phases[2].attempts[0].id);
  assert.equal(M.ledger(restored.records).unknownBilling,1);
  const reviewed=M.change(restored,'review');
  assert.equal(reviewed.plan.operation,'colors');assert.equal(reviewed.plan.calls,1);
  assert.throws(()=>M.start(reviewed),/AUTHORIZATION_REQUIRED/);
  const next=M.change(M.start(reviewed,reviewed.plan.revision),'response');
  assert.equal(count(next),before+1);
  assert.equal(M.latest(next).phases[2].attempts.length,0); // Old analysis reused, not paid again.
});

test('partial failure retains usage and old output; local recovery and paid retry are distinct',()=>{
  const failed=M.create('failed'), repaired=M.change(failed,'repair');
  assert.equal(count(repaired),count(failed));
  assert.equal(repaired.records[0].status,'failed');
  assert.equal(M.latest(repaired).status,'complete');
  assert.equal(M.timeline(repaired).find(p=>p.name==='compilation').status,'completed');
  const incomplete=M.create('incomplete'), retry=M.change(incomplete,'retry');
  assert.equal(retry.records[0].phases[2].attempts[0].usage.output_tokens,240);
  assert.equal(retry.records[0].phases[2].attempts[0].status,'failed');
  assert.equal(count(retry),count(incomplete));
  assert.throws(()=>M.start(retry),/AUTHORIZATION_REQUIRED/);
  assert.equal(retry.outputs[1].status,'Versión anterior conservada');
});

test('input changes do not claim remote work stopped or allow a concurrent new paid plan',()=>{
  const running=M.start(M.create('reanalyze'),1), changed=M.change(running,'inputs-changed');
  assert.equal(changed.job.status,'running');
  assert.equal(changed.job.stale,true);
  assert.throws(()=>M.change(changed,'review-inputs'),/OUTSTANDING_ATTEMPT/);
  assert.throws(()=>M.start(changed,1),/NOT_READY/);
  assert.equal(count(changed),count(running));
});

test('intake pauses for image review; no automatic analysis after sources complete',()=>{
  const started=M.start(M.create('fresh'),1), completed=M.change(started,'response');
  assert.equal(completed.job.status,'review-required'); assert.equal(completed.plan,null);
  assert.equal(M.latest(completed).status,'review-required');
  assert.equal(M.timeline(completed).find(p=>p.name==='analysis').status,'not-reached');
  assert.equal(count(completed),2);
  const reviewed=M.change(completed,'review');
  assert.equal(count(reviewed),2); assert.equal(reviewed.plan.paid,true);
});

test('projection accepts actual core journal observations after validation failure without changing importer',async t=>{
  const parent=path.resolve('tmp/spend-progress-qa');await mkdir(parent,{recursive:true});
  const root=await mkdtemp(path.join(parent,'journal-'));
  t.after(async()=>{assert.equal(path.dirname(path.resolve(root)),parent);await rm(root,{recursive:true,force:true});});
  const journal=await createRunRecord(root,{refresh:false,reanalyze:false,postLimit:20});
  await assert.rejects(journal.phase('analysis',async({observe})=>{
    await observe({event:'start',key:'request',provider:'synthetic',model:'synthetic-model'});
    await observe({event:'response',key:'request',usage:{input_tokens:12,output_tokens:3},billing:{amount:.1,currency:'USD',source:'synthetic-returned'}});
    await observe({event:'end',key:'request',status:'completed'});
    throw new Error('SYNTHETIC_VALIDATION_FAILURE');
  }),/SYNTHETIC_VALIDATION_FAILURE/);
  assert.throws(()=>runEffortEvents(journal.record,'USD'),/Invalid brand-run/); // Still unfinished.
  const active=M.ledger([journal.record]);assert.equal(active.byCurrency.USD,.1);
  await journal.finish('failed');
  const saved=JSON.parse(await readFile(journal.outputPath,'utf8'));
  const projected=M.ledger([saved]), imported=runEffortEvents(saved,'USD');
  assert.equal(projected.observations[0].id,imported[0].id);
  assert.equal(projected.observations[0].billing.amount,imported[0].cost);
  assert.equal(projected.observations[0].usage.input_tokens,12);
  assert.equal(saved.phases[0].status,'failed');assert.equal(saved.phases[0].attempts[0].status,'completed');
});
