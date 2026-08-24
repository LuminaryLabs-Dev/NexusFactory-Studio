import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveEditorModel } from '../src/editor-contract.js';
import { createArtifactTextureCache } from '../src/viewers/artifact-texture.js';
import { createMeshGeometry } from '../src/viewers/mesh-geometry.js';
import { createMeshMaterial } from '../src/viewers/mesh-material.js';

class Attribute { constructor(array,itemSize){this.array=array;this.itemSize=itemSize;} clone(){return new Attribute([...this.array],this.itemSize);} }
class Geometry { constructor(){this.attributes={};} setAttribute(id,value){this.attributes[id]=value;} setIndex(value){this.index=value;} computeBoundingBox(){} computeBoundingSphere(){} }
class Texture { constructor(data,width,height){this.data=data;this.image={width,height};this.disposed=false;} dispose(){this.disposed=true;} }
class Color { constructor(r=0,g=r,b=r){this.r=r;this.g=g;this.b=b;} }
class Vector2 { constructor(x,y){this.x=x;this.y=y;} }
class Material { constructor(options){Object.assign(this,options);this.disposed=false;} dispose(){this.disposed=true;} }
const THREE={
  DataTexture:Texture,RGBAFormat:1,UnsignedByteType:2,SRGBColorSpace:'srgb',NoColorSpace:'linear',NearestFilter:'nearest',LinearFilter:'linear',ClampToEdgeWrapping:'clamp',MirroredRepeatWrapping:'mirror',RepeatWrapping:'repeat',
  BufferGeometry:Geometry,Float32BufferAttribute:Attribute,Color,Vector2,MeshPhysicalMaterial:Material,MeshStandardMaterial:Material,DoubleSide:'double',FrontSide:'front'
};
const b64=Buffer.from(Uint8Array.from([255,0,0,255])).toString('base64');

test('editor model preserves generic sections, generation and export formats',()=>{
  const manifest={id:'fish',displayName:'Fish',domainPath:'n:factory:object:creature:aquatic:fish',parameterSchema:[{id:'species',type:'select',options:['oval'],default:'oval'}],provides:['artifact:textured-mesh','seed:deterministic','export:glb','export:json'],editor:{primary:['species'],advanced:['seed'],sections:[{id:'form',label:'Form',parameters:['species']}],generation:{mode:'debounced',debounceMs:420},surfaces:['seed','export']}};
  const model=deriveEditorModel(manifest);
  assert.equal(model.sections[0].parameters[0].id,'species');
  assert.equal(model.generation.debounceMs,420);
  assert.deepEqual(model.exportFormats,['glb','json']);
});

test('textured mesh helpers create UV, tangent, AO and physical material data',()=>{
  const artifact={textures:{albedo:{width:1,height:1,rgbaBase64:b64,colorSpace:'srgb',sampling:'linear',wrapS:'repeat',wrapT:'clamp'}}};
  const cache=createArtifactTextureCache(THREE,artifact);
  const source={id:'body',positions:[0,0,0,1,0,0,0,1,0],normals:[0,0,1,0,0,1,0,0,1],uvs:[0,0,1,0,0,1],tangents:[1,0,0,1,1,0,0,1,1,0,0,1],indices:[0,1,2]};
  const materialSource={name:'Skin',baseColorFactor:[1,1,1,1],baseColorTexture:'albedo',occlusionTexture:'albedo',clearcoat:.6,iridescence:.3,transmission:.1,doubleSided:false};
  const geometry=createMeshGeometry(THREE,source,materialSource);
  assert.ok(geometry.attributes.uv);
  assert.ok(geometry.attributes.uv2);
  assert.ok(geometry.attributes.tangent);
  const material=createMeshMaterial(THREE,materialSource,cache);
  assert.equal(material.map.colorSpace,'srgb');
  assert.equal(material.side,'front');
  assert.equal(material.clearcoat,.6);
  cache.dispose();
  assert.equal(material.map.disposed,true);
});
