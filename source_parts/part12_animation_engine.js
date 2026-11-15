/* Spatial Sketch 3D v2.3 — animation repair layer.
   Offline native keyframes and real GLB transform animation; no skeletal rigging claims.
   Loaded after the v2.2 controller so its UI targets are available. */
(function installAnimationV23(){
'use strict';
const el=id=>document.getElementById(id);
const near=(a,b)=>Math.abs(Number(a)-Number(b))<1e-5;
const cap=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0));
const copied=o=>JSON.parse(JSON.stringify(o));
const fpsTime=(t,a)=>Math.round(cap(t,0,a.duration)*a.fps)/a.fps;
const sorted=keys=>(keys||[]).filter(k=>Number.isFinite(k?.t)).sort((a,b)=>a.t-b.t);
let activeTrack='',currentKey=null,playHandle=0,lastStamp=0,recording=false,recordCancel=null,silent=false;
let autoKey=false,snapTime=true;
const oldState=animationState;
animationState=function(){
 const a=oldState();a.duration=cap(a.duration||6,.5,120);a.fps=cap(a.fps||24,1,120);
 a.tracks??={};a.cameraTracks??={};a.bases??={};a.cameraBases??={};
 if(Array.isArray(a.cameraFrames)&&a.cameraFrames.length&&(!Array.isArray(a.cameraTracks[0])||!a.cameraTracks[0].length))a.cameraTracks[0]=copied(a.cameraFrames);
 a.interpolation??='smooth';a.speed??=1;a.loop??=true;
 for(const [id,keys] of Object.entries(a.tracks)){if(!Array.isArray(keys)){delete a.tracks[id];continue}sorted(keys);if(!a.bases[id]&&keys.length){const k=keys[0];a.bases[id]={pos:copied(k.pos||[0,0,0]),rot:copied(k.rot||[0,0,0]),scale:copied(k.scale||[1,1,1]),color:k.color||'#888888',emit:k.emit??0,alpha:k.alpha??1,visible:k.visible!==false}}}
 a.cameraFrames=a.cameraTracks[0]||[];return a;
};
function snapshotObject(o){return {pos:copied(o.pos),rot:copied(o.rot),scale:copied(o.scale),color:o.mat?.color||'#777777',emit:o.mat?.emit??0,alpha:o.mat?.alpha??1,visible:o.visible!==false}}
function snapshotCamera(c){return{yaw:c.yaw,pitch:c.pitch,distance:c.distance,fov:c.fov,target:copied(c.target),scaleCam:c.scale,kind:c.kind}}
function setObject(o,k){if(!k)return;for(const f of ['pos','rot','scale'])if(Array.isArray(k[f]))o[f]=k[f].slice();if(!o.mat)o.mat=copied(MAT.paint);if(k.color)o.mat.color=k.color;if(Number.isFinite(k.emit))o.mat.emit=k.emit;if(Number.isFinite(k.alpha))o.mat.alpha=k.alpha;if(k.visible!==undefined)o.visible=k.visible}
function setCamera(c,k){if(!k)return;for(const f of ['yaw','pitch','distance','fov'])if(Number.isFinite(k[f]))c[f]=k[f];if(Array.isArray(k.target))c.target=k.target.slice();if(Number.isFinite(k.scaleCam))c.scale=k.scaleCam;if(k.kind)c.kind=k.kind}
function quatSL(a,b,t){let dot=a.reduce((s,v,i)=>s+v*b[i],0),bb=b.slice();if(dot<0){dot=-dot;bb=bb.map(v=>-v)}if(dot>.9995){let x=a.map((v,i)=>v+(bb[i]-v)*t);let n=Math.hypot(...x)||1;return x.map(v=>v/n)}dot=Math.min(1,Math.max(-1,dot));const theta=Math.acos(dot),s=Math.sin(theta),a1=Math.sin((1-t)*theta)/s,b1=Math.sin(t*theta)/s;return a.map((v,i)=>v*a1+bb[i]*b1)}
function mixAngle(a,b,u){const tw=Math.PI*2,d=((b-a+Math.PI)%tw+tw)%tw-Math.PI;return a+d*u}
function sampleKeys(keys,time,fallback='smooth'){
 const arr=sorted(keys);if(!arr.length)return null;
 if(time<=arr[0].t)return copied(arr[0]);if(time>=arr[arr.length-1].t)return copied(arr[arr.length-1]);
 let i=1;while(i<arr.length&&arr[i].t<time)i++;
 const a=arr[i-1],b=arr[i],raw=(time-a.t)/Math.max(1e-9,b.t-a.t),mode=a.ease||fallback;
 let u=mode==='step'?0:mode==='smooth'?raw*raw*(3-2*raw):raw;
 const out=copied(a);
 for(const f of ['pos','scale','target'])if(Array.isArray(a[f])&&Array.isArray(b[f]))out[f]=a[f].map((v,j)=>v+(b[f][j]-v)*u);
 if(Array.isArray(a.rot)&&Array.isArray(b.rot))out.rot=quatEuler(quatSL(eulerQuat(a.rot),eulerQuat(b.rot),u));
 for(const f of ['pitch','distance','fov','scaleCam','emit','alpha'])if(Number.isFinite(a[f])&&Number.isFinite(b[f]))out[f]=a[f]+(b[f]-a[f])*u;
 if(Number.isFinite(a.yaw)&&Number.isFinite(b.yaw))out.yaw=mixAngle(a.yaw,b.yaw,u);
 if(a.color&&b.color)out.color=hexColor(V.mix(rgb(a.color),rgb(b.color),u));
 out.visible=a.visible;out.kind=a.kind||b.kind;
 return out;
}
const oldPose=poseAt;
poseAt=function(keys,time){return sampleKeys(keys,time,animationState().interpolation)};
function resolvedTrack(){const a=animationState();if(activeTrack==='camera:0'||activeTrack.startsWith('camera:'))return{type:'camera',idx:cap(Number(activeTrack.slice(7)),0,3),id:activeTrack};
 const id=activeTrack.startsWith('object:')?activeTrack.slice(7):selected;
 return {type:'object',id,object:project.objects.find(o=>o.id===id),track:'object:'+id};
}
function getKeys(spec,create=false){const a=animationState();if(spec.type==='camera'){if(create)a.cameraTracks[spec.idx]??=[];return a.cameraTracks[spec.idx]||[]};if(!spec.object)return[];if(create)a.tracks[spec.id]??=[];return a.tracks[spec.id]||[]}
function addAt(keys,k){const ix=keys.findIndex(p=>near(p.t,k.t));if(ix>=0)keys[ix]=k;else keys.push(k);sorted(keys)}
function frameTime(t){const a=animationState();return snapTime?fpsTime(t,a):cap(t,0,a.duration)}
function recordObject(o,write=true){if(!o)return false;const a=animationState();a.bases[o.id]??=snapshotObject(o);const keys=a.tracks[o.id]??=[],k={...snapshotObject(o),t:Number(frameTime(timelineTime).toFixed(5)),ease:a.interpolation};addAt(keys,k);activeTrack='object:'+o.id;currentKey=k.t;if(write)commit('Recorded object keyframe at '+k.t.toFixed(2)+'s');else refresh();return true}
function recordCamera(idx,write=true){const a=animationState(),c=cams[idx];if(!c)return false;a.cameraBases[idx]??=snapshotCamera(c);const keys=a.cameraTracks[idx]??=[],k={...snapshotCamera(c),t:Number(frameTime(timelineTime).toFixed(5)),ease:a.interpolation};addAt(keys,k);a.cameraFrames=a.cameraTracks[0]||[];activeTrack='camera:'+idx;currentKey=k.t;if(write)commit('Recorded camera '+(idx+1)+' keyframe at '+k.t.toFixed(2)+'s');return true}
keyNow=function(){if(!getObj())return showToast('Select an object before recording its pose.');recordObject(getObj())};
keyCameraNow=function(){recordCamera(activePane)};
seekTimeline=function(t){
 const a=animationState();timelineTime=cap(t,0,a.duration);
 for(const [id,keys] of Object.entries(a.tracks)){const o=project.objects.find(o=>o.id===id),k=sampleKeys(keys,timelineTime,a.interpolation);if(o&&k)setObject(o,k)}
 for(const [idx,keys] of Object.entries(a.cameraTracks)){const c=cams[Number(idx)],k=sampleKeys(keys,timelineTime,a.interpolation);if(c&&k)setCamera(c,k)}
 if(el('timelineScrub'))el('timelineScrub').value=timelineTime;
 if(el('timelineCurrent'))el('timelineCurrent').textContent=timelineTime.toFixed(2)+'s';
 if(el('animTimeInput')&&document.activeElement!==el('animTimeInput'))el('animTimeInput').value=timelineTime.toFixed(3);
 if(el('viewSelect'))el('viewSelect').value=cams[activePane]?.kind||'perspective';
 // Update visible numeric fields without rebuilding the active timeline DOM each animation frame.
 const o=getObj();if(o)document.querySelectorAll('[data-vec]').forEach(f=>{if(document.activeElement!==f){const value=o[f.dataset.vec]?.[Number(f.dataset.axis)];if(Number.isFinite(value))f.value=+value.toFixed(4)}});
 refresh();return timelineTime;
};
function pause(){timelinePlaying=false;timelineFrame++;cancelAnimationFrame(playHandle);if(el('timelinePlay'))el('timelinePlay').textContent='▶ Play'}
startTimeline=function(){
 if(timelinePlaying){pause();return}
 const a=animationState();if(!Object.values(a.tracks).some(k=>k.length)&&!Object.values(a.cameraTracks).some(k=>k.length))return showToast('Add an object or camera keyframe to play.');
 if(timelineTime>=a.duration-.0001)seekTimeline(0);
 timelinePlaying=true;timelineFrame++;const token=timelineFrame;lastStamp=performance.now();if(el('timelinePlay'))el('timelinePlay').textContent='Ⅱ Pause';
 const step=t=>{if(!timelinePlaying||token!==timelineFrame)return;const delta=Math.max(0,Math.min(.15,(t-lastStamp)/1000))*cap(a.speed,.1,4);lastStamp=t;
 let next=timelineTime+delta;if(next>=a.duration){if(a.loop){next=next%a.duration}else{seekTimeline(a.duration);pause();updateTimelineUI();return}};
 seekTimeline(next);playHandle=requestAnimationFrame(step)};
 playHandle=requestAnimationFrame(step)
};
resetTimeline=function(){pause();seekTimeline(0);updateTimelineUI()};
function restoreBase(){pause();const a=animationState();for(const[id,k]of Object.entries(a.bases)){const o=project.objects.find(o=>o.id===id);if(o)setObject(o,k)}for(const[idx,k]of Object.entries(a.cameraBases))if(cams[Number(idx)])setCamera(cams[Number(idx)],k);timelineTime=0;updateTimelineUI();refresh();showToast('Restored original scene pose (non-destructive)')}
removeKey=function(){const spec=resolvedTrack(),keys=getKeys(spec);if(!keys.length)return showToast('No keys in selected track');const target=currentKey??timelineTime;const ix=keys.findIndex(k=>Math.abs(k.t-target)<Math.max(.03,1/animationState().fps*.55));if(ix<0)return showToast('Choose a keyframe marker first');keys.splice(ix,1);currentKey=null;if(spec.type==='object'&&!keys.length)delete animationState().tracks[spec.id];if(spec.type==='camera')animationState().cameraFrames=animationState().cameraTracks[0]||[];commit('Deleted keyframe');updateTimelineUI();seekTimeline(timelineTime)};
function retimeKey(){const spec=resolvedTrack(),keys=getKeys(spec),idx=keys.findIndex(k=>near(k.t,currentKey));if(idx<0)return showToast('Click a keyframe to retime it');const n=Number(el('animKeyTime').value);if(!Number.isFinite(n))return showToast('Enter a valid new keyframe time');const next=frameTime(n);if(keys.some((k,j)=>j!==idx&&near(k.t,next)))return showToast('Another key already exists at that time');keys[idx].t=next;sorted(keys);currentKey=next;commit('Moved keyframe');seekTimeline(next);updateTimelineUI()}
function trackOptions(){let options=[];for(const o of project.objects)options.push({value:'object:'+o.id,label:'◆ '+o.name});for(let i=0;i<cams.length;i++)options.push({value:'camera:'+i,label:'◈ Camera · pane '+(i+1)});return options}
function renderTracks(){const a=animationState(),options=trackOptions(),selector=el('animTrackSelect'),desired=activeTrack||((getObj()&&'object:'+getObj().id)||'camera:0');const selectedExists=options.some(o=>o.value===desired);activeTrack=selectedExists?desired:'camera:0';if(selector){let key=options.map(o=>o.value).join('|');if(selector.dataset.list!==key){selector.innerHTML='';for(const option of options){const dom=document.createElement('option');dom.value=option.value;dom.textContent=option.label;selector.add(dom)}selector.dataset.list=key;}selector.value=activeTrack}
 const spec=resolvedTrack(),keys=getKeys(spec),all=[];
 for(const o of project.objects){const list=a.tracks[o.id];if(list?.length)all.push({id:'object:'+o.id,name:o.name,keys:list})}
 for(const[id,list]of Object.entries(a.cameraTracks))if(list?.length)all.push({id:'camera:'+id,name:'Camera '+(Number(id)+1),keys:list});
 const body=el('animTrackRows');if(!body)return;body.innerHTML='';for(const row of all){const wrap=document.createElement('div');wrap.className='animTrackRow'+(row.id===activeTrack?' chosen':'');const title=document.createElement('button');title.className='animRowName';title.textContent=row.name;title.title='Select animation track';title.onclick=()=>{activeTrack=row.id;currentKey=null;if(row.id.startsWith('object:'))selectObject(row.id.slice(7));updateTimelineUI()};wrap.append(title);const lane=document.createElement('div');lane.className='animLane';for(const k of row.keys){const b=document.createElement('button');b.className='animMarker'+(row.id===activeTrack&&near(k.t,currentKey)?' picked':'');b.style.left=(100*k.t/Math.max(.5,a.duration))+'%';b.title=row.name+' · '+k.t.toFixed(3)+'s';b.setAttribute('aria-label',b.title);b.onclick=()=>{activeTrack=row.id;currentKey=k.t;if(row.id.startsWith('object:'))selectObject(row.id.slice(7));seekTimeline(k.t);updateTimelineUI()};lane.append(b)}wrap.append(lane);body.append(wrap)}
}
updateTimelineUI=function(){
 const a=animationState();if(!el('timelineScrub'))return;
 el('timelineScrub').max=a.duration;el('timelineScrub').step=1/a.fps;el('timelineScrub').value=timelineTime;
 if(document.activeElement!==el('timelineDuration'))el('timelineDuration').value=a.duration;
 if(document.activeElement!==el('timelineFPS'))el('timelineFPS').value=a.fps;
 el('timelineEnd').textContent=a.duration.toFixed(2)+'s';el('timelineCurrent').textContent=timelineTime.toFixed(2)+'s';
 el('timelineLoop').checked=a.loop;
 for(const[id,val] of [['animInterp',a.interpolation],['animSpeed',String(a.speed)]])if(el(id))el(id).value=val;
 if(el('animSnap'))el('animSnap').checked=snapTime;if(el('animAuto'))el('animAuto').checked=autoKey;
 if(el('animTimeInput')&&document.activeElement!==el('animTimeInput'))el('animTimeInput').value=timelineTime.toFixed(3);
 renderTracks();const spec=resolvedTrack(),keys=getKeys(spec);
 el('timelineKeys').innerHTML='';for(const k of keys){const b=document.createElement('button');b.className=near(k.t,currentKey)?'active':'';b.textContent=k.t.toFixed(2)+'s';b.onclick=()=>{currentKey=k.t;seekTimeline(k.t);updateTimelineUI()};el('timelineKeys').append(b)}
 if(!keys.length)el('timelineKeys').textContent='No keyframes on selected track';
 if(el('animKeyTime')&&document.activeElement!==el('animKeyTime'))el('animKeyTime').value=(currentKey??timelineTime).toFixed(3);
 const count=Object.values(a.tracks).reduce((sum,k)=>sum+k.length,0)+Object.values(a.cameraTracks).reduce((sum,k)=>sum+k.length,0);
 el('timelineSummary').textContent=count+' keys / '+Object.values(a.tracks).filter(k=>k.length).length+' objects / '+Object.values(a.cameraTracks).filter(k=>k.length).length+' cameras';
};
// Keep editable native files free of transient timeline-preview transforms and views.
const previousSerialize=serialize;
serialize=function(){const raw=JSON.parse(previousSerialize()),a=animationState();for(const o of raw.objects){const pose=a.bases[o.id];if(!pose||!a.tracks[o.id]?.length)continue;for(const f of ['pos','rot','scale'])if(pose[f])o[f]=copied(pose[f]);if(o.mat)for(const [f,original] of [['color','color'],['emit','emit'],['alpha','alpha']])if(pose[original]!==undefined)o.mat[f]=pose[original];if(pose.visible!==undefined)o.visible=pose.visible}
 if(Array.isArray(raw.views))for(const[id,cam]of Object.entries(a.cameraBases))if(raw.views[Number(id)]&&a.cameraTracks[id]?.length)Object.assign(raw.views[Number(id)],copied(cam));
 raw.animations=copied(a);raw.version=3;raw.application='spatial-sketch-3d';return JSON.stringify(raw)
};
const previousLoad=loadProject;
loadProject=function(data,reset=true){pause();previousLoad(data,reset);animationState();activeTrack='';currentKey=null;timelineTime=0;if(el('animTimeInput'))updateTimelineUI();refresh()};
const previousRemove=removeSelected;
removeSelected=function(){const o=getObj();if(o){const a=animationState();for(const target of [o,...project.objects.filter(x=>x.source===o.id)]){delete a.tracks[target.id];delete a.bases[target.id]}}
 previousRemove();currentKey=null;updateTimelineUI()};
const previousCommit=commit;
commit=function(message='Updated'){
 if(autoKey&&!silent&&!recording&&getObj()&&/moved|rotated|scaled|transform|material|opacity|color|mirrored|visibility/i.test(String(message))) {silent=true;recordObject(getObj(),false);silent=false}
 previousCommit(message);if(el('animTrackSelect'))updateTimelineUI()
};
const previousSelect=selectObject;
selectObject=function(id){previousSelect(id);if(id)activeTrack='object:'+id;currentKey=null;updateTimelineUI()};
function applyPreset(){let o=getObj();if(!o)return showToast('Select an object for animation presets');const a=animationState(),kind=el('animPreset').value,t0=0,d=a.duration,origin=snapshotObject(o);a.bases[o.id]??=copied(origin);let frames=[];
 const pose=(t,extra)=>({t,...copied(origin),ease:a.interpolation,...extra});
 if(kind==='turntable'){frames=[pose(0,{rot:origin.rot}),pose(d/2,{rot:[origin.rot[0],origin.rot[1],origin.rot[2]+180]}),pose(d,{rot:[origin.rot[0],origin.rot[1],origin.rot[2]+360]})]}
 if(kind==='bounce'){const h=Math.max(.5,Math.abs(o.scale[2])*.9);frames=[pose(0),pose(d/4,{pos:[origin.pos[0],origin.pos[1],origin.pos[2]+h]}),pose(d/2),pose(3*d/4,{pos:[origin.pos[0],origin.pos[1],origin.pos[2]+h*.45]}),pose(d)]}
 if(kind==='reveal'){frames=[pose(0,{scale:origin.scale.map(x=>x*.001),visible:true,alpha:0}),pose(d/2,{scale:origin.scale,alpha:origin.alpha}),pose(d)]}
 if(kind==='pulse'){frames=[pose(0,{emit:0}),pose(d/4,{emit:2}),pose(d/2,{emit:0}),pose(3*d/4,{emit:2}),pose(d,{emit:0})]}
 if(kind==='slide'){frames=[pose(0,{pos:[origin.pos[0]-3,origin.pos[1],origin.pos[2]]}),pose(d/2),pose(d,{pos:[origin.pos[0]+3,origin.pos[1],origin.pos[2]]})]}
 if(!frames.length)return;a.tracks[o.id]=frames;activeTrack='object:'+o.id;currentKey=null;seekTimeline(0);commit('Created '+kind+' animation preset');updateTimelineUI()
}
function clearTrack(){const spec=resolvedTrack(),keys=getKeys(spec);if(!keys.length)return showToast('Track has no keys');if(!confirm('Delete '+keys.length+' keyframes from this track?'))return;keys.length=0;const a=animationState();if(spec.type==='object')delete a.tracks[spec.id];else a.cameraFrames=a.cameraTracks[0]||[];currentKey=null;commit('Cleared animation track');updateTimelineUI()}
function exportTracks(){const a=animationState();downloadBlob(new Blob([JSON.stringify({schema:'spatialsketch.animations.v2',project:project.name,animations:a},null,2)],{type:'application/json'}),safeName(project.name)+'_animation_tracks.json')}
exportTimelineJSON=exportTracks;
function loadTracksFromJSON(file){file.text().then(text=>{const p=JSON.parse(text),candidate=p.animations||p;if(!candidate||!candidate.tracks||!Number.isFinite(candidate.duration))throw Error('Invalid Spatial Sketch 3D animation file');pause();project.animations=copied(candidate);const a=animationState();let matched=0;for(const id of Object.keys(a.tracks)){if(project.objects.some(o=>o.id===id))matched++;else delete a.tracks[id]};seekTimeline(0);commit('Imported animation tracks');updateTimelineUI();showToast('Loaded '+matched+' object tracks and camera tracks')}).catch(e=>modal('Animation import failed','<p>'+escapeHtml(e.message)+'</p>'))}
async function exportVideo(){
 if(recording)return;
 if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)return showToast('This browser cannot record canvas WebM video');
 const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(v=>MediaRecorder.isTypeSupported(v));if(!mime)return showToast('WebM recording unsupported in this browser');
 const a=animationState(),fps=Math.min(60,a.fps),duration=a.duration;
 if(!Object.values(a.tracks).some(x=>x.length)&&!Object.values(a.cameraTracks).some(x=>x.length))return showToast('Add animation keyframes before recording');
 pause();recording=true;let stopped=false;const saveTime=timelineTime,recCanvas=document.createElement('canvas');recCanvas.width=Math.min(1920,canvas.width);recCanvas.height=Math.min(1080,canvas.height);const c=recCanvas.getContext('2d');const s=recCanvas.captureStream(fps),rec=new MediaRecorder(s,{mimeType:mime,videoBitsPerSecond:5000000}),chunks=[];
 el('animVideo').textContent='■ Stop recording';el('animVideo').disabled=false;
 const done=()=>{if(stopped)return;stopped=true;recording=false;recordCancel=null;el('animVideo').textContent='● Export WebM';s.getTracks().forEach(t=>t.stop());seekTimeline(saveTime);updateTimelineUI()};
 rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
 rec.onerror=e=>{done();showToast('Video recording failed: '+(e.error?.message||'Recorder error'))};
 rec.onstop=()=>{const blob=new Blob(chunks,{type:mime});done();if(blob.size)downloadBlob(blob,safeName(project.name)+'_animation.webm');else showToast('No video frames captured')};
 let start=null,last=-1,raf=0;recordCancel=()=>{if(rec.state==='recording')rec.stop();cancelAnimationFrame(raf)};
 rec.start(250);
 const step=t=>{if(rec.state!=='recording')return;if(start===null)start=t;const elapsed=Math.max(0,(t-start)/1000),frame=Math.min(Math.floor(elapsed*fps),Math.round(duration*fps));if(frame!==last){last=frame;seekTimeline(Math.min(duration,frame/fps));drawFrame();try{c.clearRect(0,0,recCanvas.width,recCanvas.height);c.drawImage(canvas,0,0,recCanvas.width,recCanvas.height);c.drawImage(overlay,0,0,recCanvas.width,recCanvas.height)}catch(e){console.warn('Overlay capture unavailable',e)}}
 if(elapsed>=duration+.12){rec.stop();return}raf=requestAnimationFrame(step)};
 raf=requestAnimationFrame(step)
}
// Timeline UI: track lanes, framed step controls, retime, keyed camera selection, import/export.
const dock=el('timelineDock');dock.classList.add('animationV23');
const panel=document.createElement('div');panel.id='animExtra';panel.innerHTML=`<div class="animControls">
 <label>Track <select id="animTrackSelect" aria-label="Animation track"></select></label>
 <label>Time <input id="animTimeInput" type="number" min="0" step=".041667" value="0" aria-label="Current timeline time"></label>
 <button id="animPrev" title="Previous frame">◀ Frame</button><button id="animNext" title="Next frame">Frame ▶</button>
 <label>Ease <select id="animInterp"><option value="linear">Linear</option><option value="smooth">Smooth</option><option value="step">Stepped</option></select></label>
 <label>Speed <select id="animSpeed"><option value="0.25">¼×</option><option value="0.5">½×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
 <label><input type="checkbox" id="animSnap" checked> Frame snap</label><label><input type="checkbox" id="animAuto"> Auto-key edits</label>
 </div><div class="animControls"><label>Selected key time <input type="number" id="animKeyTime" step="0.041667" min="0" value="0"></label><button id="animRetime">Move key</button><button id="animClear">Clear track</button><button id="animBase">Restore base pose</button>
 <label>Preset <select id="animPreset"><option value="turntable">Object turntable</option><option value="bounce">Bounce</option><option value="slide">Slide</option><option value="pulse">Emissive pulse</option><option value="reveal">Scale reveal</option></select></label><button id="animApplyPreset">Apply to selected</button>
 <button id="animVideo" title="Real-time canvas recording, when supported">● Export WebM</button><button id="animImport">Import track JSON</button><input id="animImportFile" type="file" accept=".json,application/json" hidden>
 </div><div class="animTrackRows" id="animTrackRows" aria-label="Object and camera animation tracks"></div><div class="hint">Move/Rotate/Scale the object at a selected time, then ◆ Add object key. Camera keys use the active viewport. GLB exports object transforms; material, visibility and camera animation stay in native projects.</div>`;
dock.append(panel);
const style=document.createElement('style');style.textContent=`
 #timelineDock.animationV23{max-height:min(57vh,430px);overflow-y:auto;overscroll-behavior:contain}#timelineDock .dockHead{justify-content:center}
 .animationV23 .animControls{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:5px;margin:7px 0}
 .animationV23 .animControls label{display:inline-flex;gap:5px;align-items:center;color:var(--muted);font-size:10px}
 .animationV23 .animControls input[type=number]{width:76px;min-width:0;padding:4px}
 .animationV23 .animControls input[type=checkbox]{width:15px;flex:0 0 15px}
 .animationV23 .animControls select{max-width:165px;padding:5px}
 .animationV23 .animControls button{padding:5px 7px;font-size:10px}
 .animTrackRows{display:flex;flex-direction:column;gap:3px;margin:8px auto;max-width:100%;max-height:145px;overflow:auto;padding:2px}
 .animTrackRow{display:grid;grid-template-columns:minmax(100px,190px) minmax(0,1fr);gap:8px;align-items:center;border-radius:6px;padding:3px 5px;background:rgba(120,160,170,.08)}
 .animTrackRow.chosen{outline:1px solid var(--accent)}.animRowName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;font-size:10px}
 .animLane{height:19px;position:relative;border-radius:4px;background:repeating-linear-gradient(to right,transparent 0,transparent 9.5%,#839aa333 10%);min-width:0}
 .animMarker{position:absolute;top:4px;transform:translateX(-50%) rotate(45deg);height:10px;width:10px;min-width:10px;padding:0;border-radius:2px;background:#e19a4c;border:1px solid #263e44}
 .animMarker.picked{background:var(--accent);box-shadow:0 0 0 3px #25bbb748}
 @media(max-width:650px){#timelineDock.animationV23{max-height:60vh}.animTrackRow{grid-template-columns:88px minmax(0,1fr)}.animationV23 .animControls select{max-width:120px}}
 `;document.head.append(style);
// Replace callbacks installed by v2.1 — they captured old function behavior.
el('timelinePlay').onclick=startTimeline;el('timelineStop').onclick=resetTimeline;el('timelineKey').onclick=keyNow;el('timelineCameraKey').onclick=keyCameraNow;el('timelineDeleteKey').onclick=removeKey;
el('timelineExport').onclick=exportTracks;
el('timelineScrub').oninput=e=>{pause();seekTimeline(frameTime(Number(e.target.value)));currentKey=null;updateTimelineUI()};
el('timelineDuration').onchange=e=>{const a=animationState();a.duration=cap(e.target.value,.5,120);if(timelineTime>a.duration)timelineTime=a.duration;pause();commit('Changed animation duration');updateTimelineUI()};
el('timelineFPS').onchange=e=>{const a=animationState();a.fps=cap(e.target.value,1,120);commit('Changed timeline frame rate');updateTimelineUI()};
el('timelineLoop').onchange=e=>{animationState().loop=e.target.checked;commit('Changed animation loop mode')};
el('animTrackSelect').onchange=e=>{activeTrack=e.target.value;currentKey=null;const spec=resolvedTrack();if(spec.type==='object'&&spec.object)selectObject(spec.id);updateTimelineUI()};
el('animTimeInput').onchange=e=>{pause();seekTimeline(frameTime(Number(e.target.value)));updateTimelineUI()};
el('animPrev').onclick=()=>{pause();seekTimeline(frameTime(timelineTime-1/animationState().fps));updateTimelineUI()};
el('animNext').onclick=()=>{pause();seekTimeline(frameTime(timelineTime+1/animationState().fps));updateTimelineUI()};
el('animInterp').onchange=e=>{const a=animationState();a.interpolation=e.target.value;const spec=resolvedTrack(),keys=getKeys(spec);const chosen=keys.find(k=>near(k.t,currentKey));if(chosen)chosen.ease=e.target.value;commit('Changed animation interpolation');seekTimeline(timelineTime)};
el('animSpeed').onchange=e=>{animationState().speed=cap(e.target.value,.1,4);commit('Updated playback speed')};
el('animSnap').onchange=e=>{snapTime=e.target.checked};el('animAuto').onchange=e=>{autoKey=e.target.checked;showToast(autoKey?'Auto-key transform changes enabled':'Auto-key disabled')};
el('animRetime').onclick=retimeKey;el('animClear').onclick=clearTrack;el('animBase').onclick=restoreBase;el('animApplyPreset').onclick=applyPreset;
el('animVideo').onclick=()=>{if(recording){recordCancel?.();return}exportVideo().catch(e=>{recording=false;el('animVideo').textContent='● Export WebM';showToast('Recording failed: '+e.message)})};
el('animImport').onclick=()=>el('animImportFile').click();el('animImportFile').onchange=e=>{const f=e.target.files?.[0];if(f)loadTracksFromJSON(f);e.target.value=''};
el('timelineToggle').onclick=()=>{dock.classList.toggle('hidden');updateTimelineUI();setTimeout(()=>resizeCanvas(true),0)};
el('timelineClose').onclick=()=>{dock.classList.add('hidden');pause();resizeCanvas(true)};
window.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
 if(e.code==='Space'&&!document.body.classList.contains('presentation')){e.preventDefault();startTimeline()}if(e.key==='ArrowLeft'&&e.shiftKey){e.preventDefault();pause();seekTimeline(frameTime(timelineTime-1/animationState().fps))}if(e.key==='ArrowRight'&&e.shiftKey){e.preventDefault();pause();seekTimeline(frameTime(timelineTime+1/animationState().fps))}},true);
// Native animation demonstration. Built from editable scene objects rather than flattened video.
function motionDemo(){
 pause();newProject();project.name='KINETIC-01 | Spatial Animation Study';el('projectName').value=project.name;
 const objects=[];
 for(const [shape,name,pos,color] of [
  ['box','Rotor Housing',[-2,0,1.5],'#399eb5'],
  ['sphere','Floating Core',[0,0,2],'#ed924e'],
  ['torus','Energy Ring',[2,0,2],'#48c5a7']]){
   createPrimitive(shape);const o=getObj();o.name=name;o.pos=pos.slice();o.mat.color=color;objects.push(o);
 }
 const a=animationState();a.duration=6;a.fps=30;a.interpolation='smooth';a.speed=1;a.loop=true;
 objects.forEach((o,i)=>{
   const rest=snapshotObject(o);a.bases[o.id]=copied(rest);
   const key=(t,extra={})=>({t,...copied(rest),ease:'smooth',...extra});
   if(i===0)a.tracks[o.id]=[key(0),key(3,{rot:[0,0,180]}),key(6,{rot:[0,0,360]})];
   if(i===1)a.tracks[o.id]=[key(0),key(1.5,{pos:[0,0,3.25],emit:1.6}),key(3),key(4.5,{pos:[0,0,3.25],emit:1.6}),key(6)];
   if(i===2)a.tracks[o.id]=[key(0,{scale:[.25,.25,.25],emit:0}),key(1.5,{scale:[1.2,1.2,1.2],emit:1}),key(3,{scale:[.25,.25,.25],emit:0}),key(4.5,{scale:[1.2,1.2,1.2],emit:1}),key(6,{scale:[.25,.25,.25],emit:0})];
 });
 frameScene(false);a.cameraBases[0]=snapshotCamera(cams[0]);
 const first=snapshotCamera(cams[0]);a.cameraTracks[0]=[{t:0,...copied(first),ease:'smooth'},{t:3,...copied(first),yaw:first.yaw+Math.PI/5,ease:'smooth'},{t:6,...copied(first),ease:'smooth'}];a.cameraFrames=a.cameraTracks[0];
 selectObject(objects[0].id);timelineTime=0;seekTimeline(0);commit('Loaded KINETIC-01 editable animation demo');el('launch').classList.add('hidden');el('timelineDock').classList.remove('hidden');updateTimelineUI();
}
const motionLaunch=document.createElement('button');motionLaunch.textContent='◷ Animation';motionLaunch.title='Open editable keyframe animation demo';el('launch').querySelector('.demoList')?.append(motionLaunch);motionLaunch.onclick=motionDemo;
const motionSidebar=document.createElement('button');motionSidebar.textContent='Motion';motionSidebar.title='Open editable animation demo';document.querySelector('#toolSidebar [data-demo="environment"]')?.parentElement?.append(motionSidebar);motionSidebar.onclick=motionDemo;
// Embedded HTML presentation can play its native animation even with the authoring timeline hidden.
if(document.body.classList.contains('presentation')){const p=document.createElement('div');p.id='animPresentation';p.style.cssText='position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#122c36e8;color:#fff;z-index:500;padding:8px;border-radius:10px;display:flex;gap:8px;align-items:center;max-width:90vw';p.innerHTML='<button id="animPresentationPlay">▶ Play</button><button id="animPresentationStop">■ Stop</button><input id="animPresentationScrub" type="range" style="width:min(30vw,220px)" min="0" max="6" step=".01"><span id="animPresentationTime">0.0s</span>';document.body.append(p);el('animPresentationPlay').onclick=startTimeline;el('animPresentationStop').onclick=resetTimeline;el('animPresentationScrub').max=animationState().duration;el('animPresentationScrub').oninput=e=>{pause();seekTimeline(e.target.value)};const oldSeek=seekTimeline;seekTimeline=function(t){oldSeek(t);el('animPresentationScrub').value=timelineTime;el('animPresentationTime').textContent=timelineTime.toFixed(1)+'s';el('animPresentationPlay').textContent=timelinePlaying?'Ⅱ Pause':'▶ Play'};}
updateTimelineUI();
window.SPATIAL_ANIMATION_TEST={state:animationState,poseAt:sampleKeys,seek:seekTimeline,recordObject,recordCamera,getKeys,selectedTrack:()=>activeTrack,setTrack:t=>{activeTrack=t;updateTimelineUI()},pause,play:startTimeline,stop:resetTimeline,restore:restoreBase,applyPreset:kind=>{el('animPreset').value=kind;applyPreset()},getTime:()=>timelineTime,setSnap:s=>{snapTime=s},setEase:m=>{animationState().interpolation=m;updateTimelineUI()},setDuration:d=>{animationState().duration=d;updateTimelineUI()}};
})();
