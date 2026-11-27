const { test } = require('node:test');
const assert = require('node:assert/strict');
const { waitForArtifact } = require('../scripts/wait-pages-artifact.cjs');
const context = {token:'test',repository:'org/repo',runId:'1',artifactId:'2',sleep:async()=>{},attempts:3};
test('waits for the exact uploaded artifact to propagate',async()=>{
 let calls=0;
 await waitForArtifact({...context,fetchImpl:async()=>({ok:true,json:async()=>({artifacts:++calls===3?[{id:2,name:'github-pages',expired:false}]:[]})})});
 assert.equal(calls,3);
});
test('refuses missing or expired artifacts after a bounded wait',async()=>{
 await assert.rejects(waitForArtifact({...context,fetchImpl:async()=>({ok:true,json:async()=>({artifacts:[{id:2,name:'github-pages',expired:true}]})})}),/not visible/);
});
test('fails immediately on permission errors',async()=>{
 let calls=0;
 await assert.rejects(waitForArtifact({...context,fetchImpl:async()=>{calls++;return {ok:false,status:403};}}),/403/);
 assert.equal(calls,1);
});
