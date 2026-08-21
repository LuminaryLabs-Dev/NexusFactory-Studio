import test from "node:test";
import assert from "node:assert/strict";
import { ViewerHost } from "../src/viewer-host.js";
import { resolvePreviewType, mimeTypeForFormat } from "../src/viewer-contract.js";
import { decodeRgbaBase64, computeDisplayRect } from "../src/viewers/image-2d.js";

function fakeContainer() { return { replacements:0, replaceChildren(){ this.replacements += 1; } }; }

test("preview contracts remain generic", () => {
  assert.equal(resolvePreviewType("mesh-3d"), "mesh-3d"); assert.equal(resolvePreviewType("image-2d"), "image-2d"); assert.equal(resolvePreviewType("audio-waveform"), null);
  assert.equal(mimeTypeForFormat("glb"), "model/gltf-binary"); assert.equal(mimeTypeForFormat("png"), "image/png"); assert.equal(mimeTypeForFormat("json"), "application/json");
});

test("image helper decodes RGBA bytes and preserves integer scaling when possible", () => {
  const pixels=decodeRgbaBase64("AQIDBA=="); assert.deepEqual([...pixels],[1,2,3,4]); assert.deepEqual(computeDisplayRect(96,96,768,768),{x:0,y:0,width:768,height:768,scale:8}); assert.equal(computeDisplayRect(128,128,100,80).scale,0.625);
});

test("ViewerHost reuses same viewer and disposes on artifact-type switches", () => {
  const events=[]; const factories={"mesh-3d":()=>({show:()=>events.push("mesh:show"),dispose:()=>events.push("mesh:dispose")}),"image-2d":()=>({show:()=>events.push("image:show"),dispose:()=>events.push("image:dispose")})}; const host=new ViewerHost(fakeContainer(),factories);
  host.show("mesh-3d",{}); host.show("mesh-3d",{}); host.show("image-2d",{}); host.show("image-2d",{}); host.show("mesh-3d",{}); host.dispose();
  assert.deepEqual(events,["mesh:show","mesh:show","mesh:dispose","image:show","image:show","image:dispose","mesh:show","mesh:dispose"]);
});

test("ViewerHost delegates snapshot to the active viewer", async () => {
  const expected={type:"image/png"}; const host=new ViewerHost(fakeContainer(),{"mesh-3d":()=>({show(){},snapshot:async(type)=>({type}),dispose(){}})}); host.show("mesh-3d",{}); assert.deepEqual(await host.snapshot("image/png"),expected); host.dispose(); await assert.rejects(()=>host.snapshot(),/does not support snapshots/);
});

test("ViewerHost survives repeated image/mesh switching without stale viewers", () => {
  let created=0,disposed=0,shown=0; const factory=()=>{created+=1;return{show(){shown+=1;},dispose(){disposed+=1;}};}; const host=new ViewerHost(fakeContainer(),{"mesh-3d":factory,"image-2d":factory}); for(let index=0;index<50;index+=1)host.show(index%2===0?"image-2d":"mesh-3d",{index}); assert.equal(created,50); assert.equal(shown,50); assert.equal(disposed,49); const unsupported=host.show("audio-waveform",{}); assert.equal(unsupported.supported,false); assert.equal(disposed,50); assert.equal(host.viewer,null); assert.equal(host.type,null);
});
