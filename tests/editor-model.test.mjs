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

test("Coral image manifest derives entirely generic Studio surfaces", () => {
  const manifest = {
    id:"factory-texture-coral", displayName:"Coral Generator", domainPath:"n:factory:texture",
    provides:["artifact:image","seed:deterministic","editor:parameters","export:png"],
    parameterSchema:[
      {id:"mode",type:"select",options:["asset","reef"],default:"asset"},
      {id:"species",type:"select",options:["staghorn","elkhorn","brain","pillar","lettuce","sea-fan","sea-rod","mixed"],default:"staghorn"},
      {id:"palette",type:"select",options:["pink","orange"],default:"pink"},
      {id:"size",type:"number",minimum:0,maximum:1,default:.55},
      {id:"density",type:"number",minimum:0,maximum:1,default:.58},
      {id:"asymmetry",type:"number",minimum:0,maximum:1,default:.28},
      {id:"highlight",type:"number",minimum:0,maximum:1,default:.55},
      {id:"reefComplexity",type:"number",minimum:0,maximum:1,default:.62},
      {id:"fishDensity",type:"number",minimum:0,maximum:1,default:.48},
      {id:"waterStyle",type:"select",options:["tropical"],default:"tropical"}
    ],
    editor:{
      title:"Coral Generator",category:"Textures",preview:"image-2d",surfaces:["seed","parameters","export","diagnostics"],
      primary:["mode","species","palette","size","density","asymmetry"],
      advanced:["highlight","reefComplexity","fishDensity","waterStyle","seed"],internal:[],
      randomizationGroups:[
        {id:"everything",label:"Everything",parameters:["mode","species","palette","size","density","asymmetry","highlight","reefComplexity","fishDensity","waterStyle"],rerollSeed:true},
        {id:"form",label:"Form",parameters:["species","size","density","asymmetry"],rerollSeed:false},
        {id:"color",label:"Color",parameters:["palette","highlight","waterStyle"],rerollSeed:false},
        {id:"scene",label:"Scene",parameters:["reefComplexity","fishDensity"],rerollSeed:false}
      ]
    }
  };
  const model=deriveEditorModel(manifest);
  assert.equal(model.title,"Coral Generator");
  assert.equal(model.category,"Textures");
  assert.equal(model.preview,"image-2d");
  assert.deepEqual(model.primaryParameters.map((x)=>x.id),["mode","species","palette","size","density","asymmetry"]);
  assert.deepEqual(model.advancedParameters.map((x)=>x.id),["highlight","reefComplexity","fishDensity","waterStyle"]);
  assert.equal(model.showSeed,true);
  assert.deepEqual(model.exportFormats,["png"]);
  assert.deepEqual(model.randomizationGroups.map((x)=>x.id),["everything","form","color","scene"]);
});
