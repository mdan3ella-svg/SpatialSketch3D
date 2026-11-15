/* SPATIAL SKETCH 3D v2.4 - true glTF 2.0 skinning export and local H.264/MP4 muxing.
   Browser support for H.264 varies; capability is checked at run time. */
(function installMotionExport24(){
'use strict';
const $x=id=>document.getElementById(id), api=window.SPATIAL_MOTION_TEST;
const utf=new TextEncoder();
const bytes=(...parts)=>{let arr=parts.map(p=>typeof p==='string'?utf.encode(p):p instanceof Uint8Array?p:new Uint8Array(p)),total=arr.reduce((n,p)=>n+p.length,0),out=new Uint8Array(total),at=0;for(let p of arr){out.set(p,at);at+=p.length}return out};
const u8=n=>new Uint8Array([n&255]), u16=n=>new Uint8Array([(n>>>8)&255,n&255]),u32=n=>new Uint8Array([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]);
const packed=(type,...data)=>{const payload=bytes(...data);return bytes(u32(payload.length+8),type,payload)};
const full=(type,vers,flags,...data)=>packed(type,bytes(u8(vers),u8(flags>>16),u8(flags>>8),u8(flags)),...data);
function recordStatus(s){const e=$x('mp4Status');if(e)e.textContent=s}
function ownGLB(blob){return blob.arrayBuffer().then(buffer=>{
 const dv=new DataView(buffer);if(dv.getUint32(0,true)!==0x46546c67)throw Error('Not a glTF GLB file');const body=new Uint8Array(buffer),len=dv.getUint32(12,true),json=JSON.parse(new TextDecoder().decode(body.slice(20,20+len)).replace(/\0+$/,''));let at=20+len,bin=new Uint8Array();if(at+8<=buffer.byteLength&&dv.getUint32(at+4,true)===0x004e4942)bin=body.slice(at+8,at+8+dv.getUint32(at,true));
 const parts=[bin],a=getMotionOrThrow(),baseLen=bin.length;
 function block(data,target){let arr=data instanceof Uint8Array?data:new Uint8Array(data.buffer,data.byteOffset,data.byteLength);let length=parts.reduce((s,x)=>s+x.length,0),pad=(4-length%4)%4;if(pad){parts.push(new Uint8Array(pad));length+=pad}parts.push(arr);json.bufferViews.push({buffer:0,byteOffset:length,byteLength:arr.byteLength,...(target?{target}:{})});return json.bufferViews.length-1}
 function accessor(typed,type,component=5126,target){let view=block(typed,target),dims={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[type]||1;json.accessors.push({bufferView:view,componentType:component,count:typed.length/dims,type});return json.accessors.length-1}
 const boneIndexByObj={},animationBones=[];
 for(const o of project.objects){if(!o.mesh||!o.rig)continue;const mi=json.nodes.findIndex(n=>n.extras?.spatialSketchId===o.id);if(mi<0)continue;const meshNode=json.nodes[mi],mesh=json.meshes[meshNode.mesh],prim=mesh?.primitives?.[0];if(!prim)continue;
 const r=o.rig,n=r.restPositions.length/3;if(r.weights.length!==n)throw Error(o.name+': skeletal weights do not match mesh vertex count');const indices=new Uint16Array(n*4),weights=new Float32Array(n*4);for(let i=0;i<n;i++){
  const row=r.weights[i];if(!row)throw Error('Missing influence at vertex '+i);let sum=0;for(let j=0;j<4;j++){indices[i*4+j]=row.j[j]||0;weights[i*4+j]=Math.max(0,row.w[j]||0);sum+=weights[i*4+j]}if(sum<1e-6)weights[i*4]=1;else for(let j=0;j<4;j++)weights[i*4+j]/=sum
 }
 prim.attributes.JOINTS_0=accessor(indices,'VEC4',5123,34962);prim.attributes.WEIGHTS_0=accessor(weights,'VEC4',5126,34962);
 let nodes=[],ibms=new Float32Array(r.bones.length*16),boneEntries=[];
 for(let i=0;i<r.bones.length;i++){let bone=r.bones[i],parent=bone.parent,node={name:o.name+' / '+bone.name,translation:parent<0?bone.head.slice():bone.head.map((v,j)=>v-r.bones[parent].head[j]),rotation:[0,0,0,1]},id=json.nodes.length;json.nodes.push(node);nodes.push(id);if(parent<0){meshNode.children??=[];meshNode.children.push(id)}else{json.nodes[nodes[parent]].children??=[];json.nodes[nodes[parent]].children.push(id)}
  for(let j=0;j<16;j++)ibms[i*16+j]=j%5===0?1:0;
  ibms[i*16+12]=-bone.head[0];ibms[i*16+13]=-bone.head[1];ibms[i*16+14]=-bone.head[2];
  boneEntries.push({idx:i,node:id,object:o})
 }
 json.skins??=[];const im=accessor(ibms,'MAT4');json.skins.push({name:o.name+' skeletal bind',joints:nodes,inverseBindMatrices:im,skeleton:nodes[0]});meshNode.skin=json.skins.length-1;boneIndexByObj[o.id]=nodes;
 animationBones.push(...boneEntries)
 }
 function layerSample(l,t){if(t<l.start||t>l.end)return null;let dur=Math.max(.001,l.clipEnd-l.clipStart),local=(t-l.start)*l.speed+l.offset;if(l.loop)local=((local%dur)+dur)%dur;else local=Math.max(0,Math.min(dur,local));return l.clipStart+local}
 function boneAt(o,i,t,skipIK=false){let b=o.rig.bones[i],rotation=(b.baseRot||[0,0,0]).slice(),keys=a.rigTracks?.[o.id]?.[i];if(keys?.length)rotation=(poseAt(keys,t)?.rot||rotation).slice();const layers=a.nla.layers.filter(l=>!l.mute),solo=layers.some(l=>l.solo);for(const l of layers){if(solo&&!l.solo)continue;let lt=layerSample(l,t);if(lt==null)continue;let clips=l.boneTracks?.[o.id]?.[i];if(!clips?.length)continue;const rot=poseAt(clips,lt)?.rot,rest=clips[0]?.rot||[0,0,0];if(!rot)continue;let w=Math.max(0,Math.min(1,l.weight));rotation=rotation.map((v,j)=>l.mode==='add'?v+(rot[j]-rest[j])*w:v+(rot[j]-v)*w)}
 const targets=a.ikTracks?.[o.id];if(!skipIK&&targets&&Object.values(targets).some(clip=>clip.keys?.length)){
  const saved=o.rig.bones.map(b=>b.rot.slice());for(let j=0;j<o.rig.bones.length;j++)o.rig.bones[j].rot=boneAt(o,j,t,true);
  for(const [idx,clip]of Object.entries(targets)){if(!clip.keys?.length)continue;const pose=poseAt(clip.keys,t);if(pose?.pos)api.solveIK(o,Number(idx),pose.pos,clip.chain||2,true)}
  rotation=o.rig.bones[i].rot.slice();o.rig.bones.forEach((b,j)=>b.rot=saved[j])
 }
 return rotation}

 function affected(o,i){if(a.rigTracks?.[o.id]?.[i]?.length||Object.values(a.ikTracks?.[o.id]||{}).some(c=>c.keys?.length))return true;return a.nla.layers.some(l=>l.boneTracks?.[o.id]?.[i]?.length)}
 let anim=json.animations?.[0];if(!anim){json.animations??=[];anim={name:'SPATIAL SKETCH 3D / Motion Studio 2.4',channels:[],samplers:[]};json.animations.push(anim)}
 let count=0,fps=Math.min(30,Math.max(1,Number(a.fps)||24)),duration=Math.min(120,Number(a.duration)||6),times=Array.from({length:Math.floor(duration*fps)+1},(_,i)=>Math.min(duration,i/fps));
 for(const entry of animationBones){let o=entry.object,i=entry.idx;if(!affected(o,i))continue;count+=times.length;if(count>50000)throw Error('GLB skeletal animation exceeds 50,000 samples. Reduce duration, FPS or bone tracks.');let qprev=null,quats=[];for(const t of times){let q=eulerQuat(boneAt(o,i,t));if(qprev&&q.reduce((s,x,j)=>s+x*qprev[j],0)<0)q=q.map(x=>-x);quats.push(...q);qprev=q}
 const timesId=accessor(new Float32Array(times),'SCALAR');json.accessors[timesId].min=[times[0]];json.accessors[timesId].max=[times[times.length-1]];
 const quatId=accessor(new Float32Array(quats),'VEC4');anim.samplers.push({input:timesId,output:quatId,interpolation:'LINEAR'});anim.channels.push({sampler:anim.samplers.length-1,target:{node:entry.node,path:'rotation'}})
 }
 const merged=bytes(...parts),jbytes=utf.encode(JSON.stringify(json)),jpad=(4-jbytes.length%4)%4,bpad=(4-merged.length%4)%4;
 json.buffers[0].byteLength=merged.length+bpad;let finalJSON=utf.encode(JSON.stringify(json)),jsonPad=(4-finalJSON.length%4)%4;
 // Assemble GLB header with the updated binary and JSON chunks.
 const head=new Uint8Array(12),hv=new DataView(head.buffer);hv.setUint32(0,0x46546c67,true);hv.setUint32(4,2,true);hv.setUint32(8,12+8+finalJSON.length+jsonPad+8+merged.length+bpad,true);
 const jsonChunk=new Uint8Array(finalJSON.length+jsonPad);jsonChunk.fill(32);jsonChunk.set(finalJSON);
 return new Blob([head,u32(jsonChunk.length).reverse(),utf.encode('JSON'),jsonChunk,u32(merged.length+bpad).reverse(),utf.encode('BIN\0'),merged,new Uint8Array(bpad)],{type:'model/gltf-binary'});
})}
function getMotionOrThrow(){if(!api?.getMotion)throw Error('Motion system unavailable');return api.getMotion()}
const unmodifiedGLB=exportGLB,unmodifiedDownload=downloadBlob;
async function exportSkinnedGLB(){const needs=project.objects.some(o=>o.mesh&&o.rig);if(!needs)return unmodifiedGLB();let intercepted=false;const before=project.objects.filter(o=>o.rig).map(o=>[o,o.mesh]);let exportBlob;
 // Capture the ordinary GLB, temporarily substituting undeformed rest vertices.
 downloadBlob=function(blob,name){if(name.toLowerCase().endsWith('.glb')){intercepted=true;exportBlob=blob}else unmodifiedDownload(blob,name)};
 try{for(const[o]of before)o.mesh={...o.mesh,positions:o.rig.restPositions.slice(),normals:o.rig.restNormals.slice()};unmodifiedGLB()}finally{for(const[o,mesh]of before)o.mesh=mesh;downloadBlob=unmodifiedDownload}
 if(!intercepted||!exportBlob)throw Error('Unable to intercept native GLB for skeletal skinning');let blob=await ownGLB(exportBlob);unmodifiedDownload(blob,safeName(project.name)+'_skinned.glb');recordStatus('Skinned GLB exported with JOINTS_0/WEIGHTS_0, bind matrices and bone rotation channels.');return blob
}
exportGLB=function(){exportSkinnedGLB().catch(e=>modal('GLB skin export failed','<p>'+escapeHtml(e.message)+'</p>'))};
$x('rigGLBExport').onclick=exportGLB;
function mp4Mux(samples,width,height,fps,avcc){
 // ISO BMFF / AVC file, one chunk, fixed frame rate, no B-frames. AVC configuration comes from the browser encoder.
 const ticks=90000,delta=Math.round(ticks/fps),duration=samples.length*delta;
 const matrix=bytes(u32(65536),u32(0),u32(0),u32(0),u32(65536),u32(0),u32(0),u32(0),u32(1073741824));
 const ft=packed('ftyp','isom',u32(512),'isom','iso2','avc1','mp41');
 const mvhd=full('mvhd',0,0,u32(0),u32(0),u32(ticks),u32(duration),u32(65536),u16(256),u16(0),u32(0),u32(0),matrix,bytes(u32(0),u32(0),u32(0),u32(0),u32(0),u32(0)),u32(2));
 const tkhd=full('tkhd',0,7,u32(0),u32(0),u32(1),u32(0),u32(duration),u32(0),u32(0),u16(0),u16(0),u16(0),u16(0),matrix,u32(width<<16),u32(height<<16));
 const mdhd=full('mdhd',0,0,u32(0),u32(0),u32(ticks),u32(duration),u16(0x55c4),u16(0));
 const hdlr=full('hdlr',0,0,u32(0),'vide',u32(0),u32(0),u32(0),'VideoHandler\0');
 const vmhd=full('vmhd',0,1,u16(0),u16(0),u16(0),u16(0));
 const dinf=packed('dinf',full('dref',0,0,u32(1),full('url ',0,1)));
 const name=new Uint8Array(32);const n=utf.encode('Spatial Sketch H264');name[0]=n.length;name.set(n,1);
 const avc1=packed('avc1',new Uint8Array(6),u16(1),u16(0),u16(0),u32(0),u32(0),u32(0),u16(width),u16(height),u32(0x00480000),u32(0x00480000),u32(0),u16(1),name,u16(24),u16(0xffff),packed('avcC',avcc));
 const stsd=full('stsd',0,0,u32(1),avc1);
 const stts=full('stts',0,0,u32(1),u32(samples.length),u32(delta));
 const stsc=full('stsc',0,0,u32(1),u32(1),u32(samples.length),u32(1));
 const stsz=full('stsz',0,0,u32(0),u32(samples.length),...samples.map(s=>u32(s.data.length)));
 const stss=full('stss',0,0,u32(samples.filter(s=>s.key).length),...samples.map((s,i)=>s.key?u32(i+1):null).filter(Boolean));
 function mov(offset){const stco=full('stco',0,0,u32(1),u32(offset));return packed('moov',mvhd,packed('trak',tkhd,packed('mdia',mdhd,hdlr,packed('minf',vmhd,dinf,packed('stbl',stsd,stts,stsc,stsz,stco,stss))))) }
 const first=mov(0),offset=ft.length+first.length+8,moov=mov(offset),mdat=packed('mdat',...samples.map(s=>s.data));return new Blob([ft,moov,mdat],{type:'video/mp4'})
}
let exportingMP4=false;
async function recordNativeMP4(width,height,fps,duration,saveTime){
 const mime=['video/mp4;codecs=avc1.42E01E','video/mp4;codecs=avc1.42001E','video/mp4'].find(m=>window.MediaRecorder?.isTypeSupported(m));
 if(!mime){recordStatus('No local MP4 encoder available. Use the WebM export control in the timeline.');return}
 const offscreen=document.createElement('canvas');offscreen.width=width;offscreen.height=height;const ctx=offscreen.getContext('2d');const stream=offscreen.captureStream(0),track=stream.getVideoTracks()[0];
 const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:Math.min(9000000,width*height*fps*.18)}),chunks=[];
 recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
 let stopResolve,stopReject;const stopped=new Promise((res,rej)=>{stopResolve=res;stopReject=rej});
 recorder.onerror=e=>stopReject(e.error||Error('MP4 recorder failed'));recorder.onstop=stopResolve;
 exportingMP4=true;$x('mp4Export').disabled=true;
 try{window.SPATIAL_ANIMATION_TEST?.pause();recorder.start(200);const frames=Math.floor(duration*fps)+1;
  for(let i=0;i<frames;i++){seekTimeline(Math.min(duration,i/fps));drawFrame();ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(canvas,0,0,width,height);ctx.drawImage(overlay,0,0,width,height);track.requestFrame?.();
   if(i%Math.max(1,Math.floor(fps/2))===0)recordStatus(`Recording H.264 MP4 frame ${i+1} / ${frames}`);
   await new Promise(r=>setTimeout(r,1000/fps))
  }
  recorder.stop();await stopped;const movie=new Blob(chunks,{type:'video/mp4'});if(movie.size<512)throw Error('The browser emitted no MP4 data');
  const sig=await movie.slice(4,8).text();if(sig!=='ftyp')throw Error('Recorder output is not an ISO BMFF MP4 file');
  unmodifiedDownload(movie,safeName(project.name)+'_H264.mp4');recordStatus(`MP4 exported with browser recorder: ${(movie.size/1048576).toFixed(2)} MiB`)
 }catch(e){if(recorder.state!=='inactive')recorder.stop();recordStatus('Native MP4 recording failed: '+e.message)}finally{stream.getTracks().forEach(t=>t.stop());exportingMP4=false;$x('mp4Export').disabled=false;seekTimeline(saveTime);updateTimelineUI()}
}
async function videoH264(){if(exportingMP4)return;const a=getMotionOrThrow();if(!Object.values(a.tracks).some(x=>x.length)&&!Object.values(a.rigTracks||{}).some(x=>Object.values(x).some(y=>y.length))&&!a.nla.layers.length)return showToast('Keyframe an object, bone or action before exporting video');
 const width=Number($x('mp4Size').value)||640,height=Math.round(width*9/16),fps=Number($x('mp4FPS').value)||24,duration=Math.min(30,a.duration),count=Math.floor(duration*fps)+1,saveTime=timelineTime;
 const cap=window.VideoEncoder&&window.VideoFrame&&VideoEncoder.isConfigSupported;
 if(!cap)return recordNativeMP4(width,height,fps,duration,saveTime);
 const configuration={codec:'avc1.42001E',width,height,bitrate:Math.min(9000000,width*height*fps*.17),framerate:fps,avc:{format:'avc'},latencyMode:'realtime'};
 const support=await VideoEncoder.isConfigSupported(configuration);if(!support.supported)return recordNativeMP4(width,height,fps,duration,saveTime);
 const offscreen=document.createElement('canvas');offscreen.width=width;offscreen.height=height;const ctx=offscreen.getContext('2d',{alpha:false});
 const frames=[];let codecConfig=null,err=null;
 const encoder=new VideoEncoder({output:(chunk,metadata)=>{if(metadata?.decoderConfig?.description)codecConfig=new Uint8Array(metadata.decoderConfig.description);let data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);frames.push({data,key:chunk.type==='key',timestamp:chunk.timestamp})},error:e=>{err=e}});
 encoder.configure(configuration);exportingMP4=true;$x('mp4Export').disabled=true;recordStatus('Encoding H.264 locally…');
 try{if(typeof window.SPATIAL_ANIMATION_TEST?.pause==='function')window.SPATIAL_ANIMATION_TEST.pause();
  for(let i=0;i<count;i++){
   let t=Math.min(duration,i/fps);seekTimeline(t);drawFrame();ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);ctx.drawImage(canvas,0,0,width,height);ctx.drawImage(overlay,0,0,width,height);
   const vf=new VideoFrame(offscreen,{timestamp:Math.round(i*1e6/fps),duration:Math.round(1e6/fps)});encoder.encode(vf,{keyFrame:i===0||i%fps===0});vf.close();if(i%16===0){recordStatus(`Encoding frame ${i+1} / ${count} (H.264)`);await new Promise(resolve=>requestAnimationFrame(resolve))}if(encoder.encodeQueueSize>16)await encoder.flush()
  }
  await encoder.flush();if(err)throw err;frames.sort((a,b)=>a.timestamp-b.timestamp);if(!codecConfig)throw Error('Encoder did not provide an AVC decoder configuration (avcC). This browser cannot mux MP4.');
  let movie=mp4Mux(frames,width,height,fps,codecConfig);unmodifiedDownload(movie,safeName(project.name)+'_H264.mp4');recordStatus(`MP4 created: ${frames.length} H.264 frames, ${(movie.size/1048576).toFixed(2)} MiB.`);
 }catch(e){recordStatus('MP4 export failed: '+e.message+' — WebM is still available.');console.error(e)}finally{encoder.close();exportingMP4=false;$x('mp4Export').disabled=false;seekTimeline(saveTime);updateTimelineUI()}
}
$x('mp4Export').onclick=()=>videoH264().catch(e=>recordStatus('Encoder not available: '+e.message));
window.SPATIAL_MOTION_EXPORT_TEST={ownGLB,exportSkinnedGLB,mp4Mux,videoH264};
})();
