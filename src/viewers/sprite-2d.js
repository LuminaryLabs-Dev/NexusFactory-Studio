import { decodeRgbaBase64, computeDisplayRect } from './image-2d.js';

// Generic sprite animation viewer; depends only on artifact metadata, not Kit identity.
export function resolveSpriteAnimation(artifact) {
  if (artifact?.artifactKind !== 'image' || artifact.image?.pixelFormat !== 'rgba8' || artifact.image?.channels !== 4) throw new TypeError('Sprite viewer requires a RGBA image artifact.');
  const a=artifact.metadata?.animation,image=artifact.image;
  if(a?.schemaVersion!=='nexusfactory.sprite-atlas/1')throw new TypeError('Sprite animation descriptor is missing or unsupported.');
  const integers=[a.frameWidth,a.frameHeight,a.frameCount,a.columns,a.rows,a.fps];
  if(!integers.every(n=>Number.isInteger(n)&&n>0)||a.frameCount>256||a.fps>120)throw new RangeError('Invalid sprite animation dimensions or timing.');
  if(a.columns*a.rows<a.frameCount||a.frameWidth*a.columns>image.width||a.frameHeight*a.rows>image.height)throw new RangeError('Sprite animation frames exceed atlas bounds.');
  if(a.frameOrder!=='row-major')throw new TypeError('Unsupported frame order.');
  return { ...a };
}
export function frameRect(a,index) {
  if(!Number.isInteger(index)||index<0||index>=a.frameCount)throw new RangeError('Sprite frame index out of range.');
  return {x:(index%a.columns)*a.frameWidth,y:Math.floor(index/a.columns)*a.frameHeight,width:a.frameWidth,height:a.frameHeight};
}
export class Sprite2DViewer {
  constructor(container) {
    this.container=container;
    this.root=document.createElement('div');this.root.className='sprite-viewer';
    this.stage=document.createElement('div');this.stage.className='sprite-stage';
    this.canvas=document.createElement('canvas');this.canvas.className='image-2d-canvas transparent';
    this.context=this.canvas.getContext('2d',{alpha:true});if(!this.context)throw new Error('Sprite viewer requires a 2D canvas context.');
    this.source=document.createElement('canvas');this.sourceContext=this.source.getContext('2d',{alpha:true});if(!this.sourceContext)throw new Error('Sprite viewer requires a source canvas context.');
    this.toolbar=document.createElement('div');this.toolbar.className='sprite-toolbar';
    this.previous=this.makeButton('◀','Previous frame',()=>this.step(-1));
    this.play=this.makeButton('Pause','Play or pause',()=>this.toggle());
    this.next=this.makeButton('▶','Next frame',()=>this.step(1));
    this.counter=document.createElement('span');this.counter.className='sprite-counter';this.counter.setAttribute('aria-live','off');
    this.toolbar.append(this.previous,this.play,this.next,this.counter);
    this.stage.append(this.canvas);this.root.append(this.stage,this.toolbar);container.append(this.root);
    this.frame=0;this.running=false;this.last=0;this.request=null;this.animation=null;this.image=null;
    this.raf=(time)=>this.tick(time);
    this.observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>this.resize()):null;
    this.observer?.observe(this.stage);
  }
  makeButton(title,label,callback){const button=document.createElement('button');button.type='button';button.textContent=title;button.setAttribute('aria-label',label);button.addEventListener('click',callback);return button;}
  show(artifact){
    const animation=resolveSpriteAnimation(artifact),image=artifact.image,pixels=decodeRgbaBase64(image.rgbaBase64);
    if(pixels.length!==image.width*image.height*4)throw new RangeError('Sprite atlas payload size mismatch.');
    this.pause();this.image=image;this.animation=animation;this.frame=0;this.source.width=image.width;this.source.height=image.height;
    this.sourceContext.clearRect(0,0,image.width,image.height);
    this.sourceContext.putImageData(new ImageData(pixels,image.width,image.height),0,0);
    this.resize();this.start();
  }
  resize(){
    const width=Math.max(1,this.stage.clientWidth||1),height=Math.max(1,this.stage.clientHeight||1),ratio=Math.min(globalThis.devicePixelRatio??1,2);
    this.canvas.width=Math.round(width*ratio);this.canvas.height=Math.round(height*ratio);
    this.canvas.style.width=`${width}px`;this.canvas.style.height=`${height}px`;
    this.context.setTransform(ratio,0,0,ratio,0,0);this.draw();
  }
  draw(){
    const w=this.stage.clientWidth||1,h=this.stage.clientHeight||1;
    this.context.clearRect(0,0,w,h);
    if(!this.animation)return;
    const source=frameRect(this.animation,this.frame),dest=computeDisplayRect(source.width,source.height,w,h);
    this.context.imageSmoothingEnabled=false;
    this.context.drawImage(this.source,source.x,source.y,source.width,source.height,dest.x,dest.y,dest.width,dest.height);
    this.counter.textContent=`Frame ${this.frame+1}/${this.animation.frameCount} • ${this.animation.fps} FPS`;
  }
  tick(time){
    if(!this.running||!this.animation)return;
    if(!this.last)this.last=time;
    const frameMs=1000/this.animation.fps,elapsed=time-this.last;
    if(elapsed>=frameMs){const advance=Math.floor(elapsed/frameMs);const next=this.frame+advance;this.frame=this.animation.loop ? next%this.animation.frameCount : Math.min(next,this.animation.frameCount-1);this.last+=advance*frameMs;this.draw();if(!this.animation.loop&&this.frame===this.animation.frameCount-1){this.pause();return;}}
    this.request=requestAnimationFrame(this.raf);
  }
  start(){if(!this.animation||this.running)return;if(!this.animation.loop&&this.frame>=this.animation.frameCount-1){this.frame=0;this.draw();}this.running=true;this.last=0;this.play.textContent='Pause';this.request=requestAnimationFrame(this.raf);}
  pause(){this.running=false;this.last=0;if(this.request!==null)cancelAnimationFrame(this.request);this.request=null;this.play.textContent='Play';}
  toggle(){if(this.running)this.pause();else this.start();}
  step(shift){if(!this.animation)return;this.pause();this.frame=this.animation.loop?(this.frame+shift+this.animation.frameCount)%this.animation.frameCount:Math.max(0,Math.min(this.animation.frameCount-1,this.frame+shift));this.draw();}
  snapshot(type='image/png'){return new Promise((resolve,reject)=>this.canvas.toBlob(b=>b?resolve(b):reject(new Error('Sprite snapshot failed.')),type));}
  dispose(){this.pause();this.observer?.disconnect();this.source.width=0;this.source.height=0;this.root.remove();this.image=null;this.animation=null;}
}
