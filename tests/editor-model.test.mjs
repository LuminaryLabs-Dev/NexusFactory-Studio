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

const imageManifest=(id,title,domainPath,category,{phased=false}={})=>({
  id,displayName:title,domainPath,
  provides:["artifact:image","seed:deterministic","editor:parameters","export:png",...(phased?["factory:phases"]:[])],
  services:["describe","generate","randomize","reroll","validate","export",...(phased?["createState","inspectState","runPhase"]:[])],
  parameterSchema:[{id:"density",label:"Density",type:"number",minimum:0,maximum:1,default:.5}],
  editor:{title,category,preview:"image-2d",surfaces:["seed","parameters","export","diagnostics",...(phased?["phases"]:[])],primary:["density"],advanced:["seed"],internal:[],randomizationGroups:[{id:"everything",label:"Everything",parameters:["density"],rerollSeed:true}]},
  metadata:phased?{phaseOrder:["terrain","environment","population","placement","subjects","effects","compose","artifact","validate"]}:{}
});

test("aquatic manifests remain entirely generic Studio inputs", () => {
  const manifests=[
    imageManifest("factory-texture-coral","Coral Generator","n:factory:texture:subject:coral","Textures"),
    imageManifest("factory-texture-fish","Fish Generator","n:factory:texture:subject:fish","Textures"),
    imageManifest("factory-texture-aquatic-flora","Aquatic Flora Generator","n:factory:texture:subject:aquatic-flora","Textures"),
    imageManifest("factory-scene-aquatic-reef","Reef Generator","n:factory:scene:aquatic:reef","Scenes",{phased:true}),
    imageManifest("factory-scene-aquatic-aquarium","Aquarium Generator","n:factory:scene:aquatic:aquarium","Scenes",{phased:true})
  ];
  for(const manifest of manifests){const model=deriveEditorModel(manifest);assert.equal(model.preview,"image-2d");assert.equal(model.category,manifest.editor.category);assert.deepEqual(model.exportFormats,["png"]);assert.equal(model.showSeed,true);assert.equal(categoryForKit(manifest),manifest.editor.category);}
  for(const manifest of manifests.slice(3)){assert.deepEqual(manifest.metadata.phaseOrder,["terrain","environment","population","placement","subjects","effects","compose","artifact","validate"]);assert.ok(manifest.services.includes("runPhase"));}
  assert.deepEqual(buildCatalog(manifests,"","Textures").map(x=>x.id).sort(),["factory-texture-aquatic-flora","factory-texture-coral","factory-texture-fish"]);
  assert.deepEqual(buildCatalog(manifests,"","Scenes").map(x=>x.id).sort(),["factory-scene-aquatic-aquarium","factory-scene-aquatic-reef"]);
});
