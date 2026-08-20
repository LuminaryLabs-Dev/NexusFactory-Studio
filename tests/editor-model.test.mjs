import test from "node:test";
import assert from "node:assert/strict";
import { deriveEditorModel } from "../src/editor-contract.js";
import { buildCatalog, categoryForKit } from "../src/catalog-model.js";

test("editor model separates primary and advanced controls", () => {
  const model = deriveEditorModel({ id:"ballista", displayName:"Ballista", domainPath:"n:factory:object:weapon", parameterSchema:[{id:"scale",default:1},{id:"mechanismCount",default:3},{id:"wear",default:.2}], provides:["seed:deterministic","export:glb"], editor:{ primary:["scale","wear"], advanced:["mechanismCount","seed"], internal:[], randomizationGroups:[{id:"shape",label:"Shape",parameters:["scale"]}] } });
  assert.deepEqual(model.primaryParameters.map((x)=>x.id), ["scale","wear"]);
  assert.deepEqual(model.advancedParameters.map((x)=>x.id), ["mechanismCount"]);
  assert.equal(model.showSeed, true);
  assert.equal(model.randomizationGroups[0].id, "shape");
});

test("editor model infers a clean fallback for older manifests", () => {
  const model = deriveEditorModel({ id:"legacy", displayName:"Legacy", parameterSchema:[{id:"scale"},{id:"detailCount"},{id:"wear"}], provides:["seed:deterministic"], editor:{surfaces:["seed"]} });
  assert.deepEqual(model.primaryParameters.map((x)=>x.id), ["scale","wear"]);
  assert.deepEqual(model.advancedParameters.map((x)=>x.id), ["detailCount"]);
  assert.ok(model.randomizationGroups.some((group)=>group.id==="materials" && group.parameters.includes("wear")));
});

test("catalog uses human categories and search", () => {
  const kits=[{id:"b",displayName:"Windup Ballista",domainPath:"n:factory:object:weapon"},{id:"t",displayName:"Broadleaf Tree",domainPath:"n:factory:object:foliage"}];
  assert.equal(categoryForKit(kits[0]), "Weapons");
  assert.equal(categoryForKit(kits[1]), "Nature");
  assert.deepEqual(buildCatalog(kits,"ball").map((x)=>x.id), ["b"]);
});
