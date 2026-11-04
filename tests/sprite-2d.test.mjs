import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSpriteAnimation,frameRect} from '../src/viewers/sprite-2d.js';
const fixture={artifactKind:'image',image:{width:256,height:32,pixelFormat:'rgba8',channels:4,rgbaBase64:'AAAA'},metadata:{animation:{schemaVersion:'nexusfactory.sprite-atlas/1',frameWidth:32,frameHeight:32,frameCount:8,columns:8,rows:1,frameOrder:'row-major',fps:12,loop:true}}};
test('generic sprite descriptor can resolve without Kit identification',()=>{
  assert.equal(resolveSpriteAnimation(fixture).frameCount,8);
  assert.deepEqual(frameRect(resolveSpriteAnimation(fixture),3),{x:96,y:0,width:32,height:32});
});
test('bounds, frame ordering and invalid inputs are rejected',()=>{
  assert.throws(()=>frameRect(fixture.metadata.animation,8),RangeError);
  assert.throws(()=>resolveSpriteAnimation({...fixture,metadata:{animation:{...fixture.metadata.animation,columns:12}}}),RangeError);
  assert.throws(()=>resolveSpriteAnimation({...fixture,metadata:{animation:{...fixture.metadata.animation,frameOrder:'column-major'}}}),TypeError);
  assert.throws(()=>resolveSpriteAnimation({...fixture,metadata:{animation:{...fixture.metadata.animation,fps:0}}}),RangeError);
});
