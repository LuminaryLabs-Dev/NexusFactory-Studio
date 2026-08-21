import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeHost } from "../src/runtime-host.js";

function makeRuntime() {
  const calls=[];
  const kit={services:{
    describe:()=>({id:"mock",services:["describe","createState","inspectState","runPhase","generate","randomize","reroll","validate","export"]}),
    createState:(request)=>({kind:"state",request}), inspectState:(state)=>({state}), runPhase:(state,phase)=>({...state,phase}),
    generate:(request)=>({kind:"artifact",request}), randomize:(request)=>({kind:"randomized",request}), reroll:(request)=>({kind:"rerolled",request}),
    validate:(artifact)=>({valid:true,artifact}), export:(artifact,format)=>({format,artifact})
  }};
  const registry={async loadKit(id){calls.push(id);return kit;}};
  return {runtime:new RuntimeHost(registry),calls};
}

test("RuntimeHost remains a thin generic service invoker", async()=>{
  const {runtime,calls}=makeRuntime(),request={seed:"x"};
  assert.equal((await runtime.describe("mock")).id,"mock");
  const state=await runtime.createState("mock",request); assert.equal(state.kind,"state");
  assert.ok((await runtime.inspectState("mock",state)).state);
  assert.equal((await runtime.runPhase("mock",state,"growth")).phase,"growth");
  assert.equal((await runtime.generate("mock",request)).kind,"artifact");
  assert.equal((await runtime.randomize("mock",request)).kind,"randomized");
  assert.equal((await runtime.reroll("mock",request)).kind,"rerolled");
  assert.equal((await runtime.validate("mock",{})).valid,true);
  assert.equal((await runtime.exportArtifact("mock",{},"glb")).format,"glb");
  assert.equal(calls.length,9);
});

test("RuntimeHost rejects missing services instead of implementing domain fallbacks",async()=>{
  const runtime=new RuntimeHost({async loadKit(){return{services:{}};}});
  await assert.rejects(()=>runtime.randomize("mock",{}),/does not provide service randomize/);
});
