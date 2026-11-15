/* SPATIAL SKETCH 3D v2.4 - articulated envelope rigging, IK, NLA composition and deterministic contact dynamics.
   All motion is native and editable. This is an interactive character/assembly rig and lightweight rigid-body solver,
   not anatomical inference or an engineering-certified physics solver. */
(function installMotionStudio24(){
'use strict';
const $m=id=>document.getElementById(id), deep=o=>JSON.parse(JSON.stringify(o));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,Number(x)||0));
const a3=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],s3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],m3=(a,v)=>a.map(q=>q*v);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),unit=a=>m3(a,1/(len(a)||1));
const qnorm=q=>m3(q,1/(Math.hypot(...q)||1)),qmul=(a,b)=>qnorm([
 a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
 a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
 a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
 a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]]);
const qinv=q=>[-q[0],-q[1],-q[2],q[3]];
function qrot(q,v){const t=m3(cross(q.slice(0,3),v),2);return a3(v,a3(m3(t,q[3]),cross(q.slice(0,3),t)))}
function qfrom(a,b){a=unit(a);b=unit(b);let d=dot(a,b);if(d<-.999999){let axis=unit(cross(a,Math.abs(a[0])<.8?[1,0,0]:[0,1,0]));return [...axis,0]};return qnorm([...cross(a,b),1+d])}
function eulerFromQuat(q){const[x,y,z,w]=qnorm(q);const sinr=2*(w*x+y*z),cosr=1-2*(x*x+y*y),r=Math.atan2(sinr,cosr),s=Math.max(-1,Math.min(1,2*(w*y-z*x))),p=Math.asin(s),sinz=2*(w*z+x*y),cosz=1-2*(y*y+z*z);return [r,p,Math.atan2(sinz,cosz)].map(n=>n*180/Math.PI)}
function getMotion(){const a=animationState();a.rigTracks??={};a.ikTracks??={};a.nla??={layers:[]};a.nla.layers??=[];a.nla.bases??={};a.physics??={enabled:false,gravity:-9.81,ground:0,substeps:1};return a}
let chosenBone=0,rigEdit=true,chosenLayer='',physicsCache={time:-1,states:{}},inSkin=false,skipDrawOverlay=false;
function selectRig(){const o=getObj();return o?.rig&&o.mesh?o:null}
function boundsOf(mesh){const n=mesh.positions.length/3,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<n;i++)for(let j=0;j<3;j++){const v=mesh.positions[i*3+j];min[j]=Math.min(min[j],v);max[j]=Math.max(max[j],v)}return{min,max,mid:min.map((x,j)=>(x+max[j])/2),size:min.map((x,j)=>Math.max(.02,max[j]-x))}}
function templateBones(type,b){
 const c=b.mid,[sx,sy,sz]=b.size;let bones=[];
 function bone(name,parent,head,tail){const k=bones.length;bones.push({name,parent,head,tail,rot:[0,0,0]});return k}
 const x=u=>c[0]+u*sx,y=u=>c[1]+u*sy,z=u=>b.min[2]+u*sz;
 if(type==='chain'){let n=bone('Root',-1,[x(0),y(0),z(.1)],[x(0),y(0),z(.4)]);n=bone('Middle',n,[x(0),y(0),z(.4)],[x(0),y(0),z(.7)]);bone('Tip',n,[x(0),y(0),z(.7)],[x(0),y(0),z(.98)]);return bones}
 const root=bone('Pelvis',-1,[x(0),y(0),z(.48)],[x(0),y(0),z(.60)]),sp=bone('Spine',root,[x(0),y(0),z(.60)],[x(0),y(0),z(.82)]);
 bone('Neck',sp,[x(0),y(0),z(.82)],[x(0),y(0),z(.95)]);
 if(type==='quadruped'){
  const bd=bone('Back',root,[x(0),y(0),z(.48)],[x(0),y(-.26),z(.56)]);bone('Tail',bd,[x(0),y(-.26),z(.56)],[x(0),y(-.48),z(.62)]);
  for(const s of [-1,1])for(const side of ['front','rear']){const fy=side==='front'?-.34:.30,j=bone((s<0?'L':'R')+' '+side+' upper',root,[x(s*.29),y(fy),z(.48)],[x(s*.30),y(fy),z(.25)]);bone((s<0?'L':'R')+' '+side+' lower',j,[x(s*.30),y(fy),z(.25)],[x(s*.30),y(fy),z(.01)])}
 }else {
  for(const s of [-1,1]){let shoulder=bone((s<0?'L':'R')+' upper arm',sp,[x(s*.21),y(0),z(.78)],[x(s*.36),y(0),z(.64)]);bone((s<0?'L':'R')+' forearm',shoulder,[x(s*.36),y(0),z(.64)],[x(s*.48),y(0),z(.55)]);let thigh=bone((s<0?'L':'R')+' thigh',root,[x(s*.15),y(0),z(.48)],[x(s*.15),y(0),z(.25)]);bone((s<0?'L':'R')+' shin',thigh,[x(s*.15),y(0),z(.25)],[x(s*.15),y(0),z(.02)])}
 }
 return bones
}
function distToSegment(p,a,b){const d=s3(b,a),ll=dot(d,d)||1,t=clamp(dot(s3(p,a),d)/ll,0,1),v=s3(p,a3(a,m3(d,t)));return len(v)}
function shellComponents(mesh){const n=mesh.positions.length/3,parent=Array.from({length:n},(_,i)=>i);function find(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i]}return i}function join(i,j){const a=find(i),b=find(j);if(a!==b)parent[b]=a}
 const coord=new Map();for(let i=0;i<n;i++){const key=mesh.positions.slice(i*3,i*3+3).map(x=>Math.round(x*1e5)).join(',');if(coord.has(key))join(i,coord.get(key));else coord.set(key,i)}for(let i=0;i<mesh.indices.length;i+=3){let a=mesh.indices[i],b=mesh.indices[i+1],c=mesh.indices[i+2];join(a,b);join(b,c)}
 const components=new Map();for(let i=0;i<n;i++){const r=find(i);if(!components.has(r))components.set(r,[]);components.get(r).push(i)}return [...components.values()]
}
function autoWeights(mesh,bones,mode){const n=mesh.positions.length/3,weights=Array(n);if(mode==='rigid'){
  for(const group of shellComponents(mesh)){const center=[0,0,0];for(const i of group)for(let j=0;j<3;j++)center[j]+=mesh.positions[i*3+j]/group.length;
   let best=0,bd=Infinity;for(let j=0;j<bones.length;j++){let d=distToSegment(center,bones[j].head,bones[j].tail);if(d<bd){bd=d;best=j}}
   for(const i of group)weights[i]={j:[best,0,0,0],w:[1,0,0,0]};
  }
 }else for(let i=0;i<n;i++){const p=mesh.positions.slice(i*3,i*3+3),rank=bones.map((bone,j)=>({j,d:distToSegment(p,bone.head,bone.tail)})).sort((a,b)=>a.d-b.d).slice(0,4),maxSize=Math.max(.01,...bones.map(b=>len(s3(b.tail,b.head))));const terms=rank.map(x=>1/Math.pow(x.d+maxSize*.07,2)),sum=terms.reduce((a,b)=>a+b,0);weights[i]={j:rank.map(x=>x.j).concat(Array(4-rank.length).fill(0)),w:terms.map(x=>x/sum).concat(Array(4-rank.length).fill(0))}}
 return weights
}
function rigObject(kind='humanoid',weightMode='smooth'){
 const o=getObj();if(!o?.mesh)return showToast('Select a mesh object before auto-rigging.');const vertices=o.mesh.positions.length/3;if(vertices>28000)return showToast('Real-time CPU skinning limit: 28,000 vertices. Decimate or split the mesh first.');if(o.rig&&o.rig.restPositions){o.mesh={...o.mesh,positions:o.rig.restPositions.slice()};disposeGpu(o.id)}
 const base=deep(o.mesh),bones=templateBones(kind,boundsOf(base)),weights=autoWeights(base,bones,weightMode);
 o.rig={version:1,template:kind,mode:weightMode,bones,weights,restPositions:base.positions.slice(),restNormals:base.normals.slice()};
 chosenBone=0;getMotion().rigTracks[o.id]??={};commit('Created editable '+kind+' skeletal rig');updateMotionUI();refresh();return o
}
function boneTransforms(o){const bones=o.rig.bones,poses=[];for(let i=0;i<bones.length;i++){let b=bones[i],parent=b.parent>=0?poses[b.parent]:null,q=qnorm(eulerQuat(b.rot||[0,0,0]));if(parent)poses.push({head:a3(parent.head,qrot(parent.quat,s3(b.head,bones[b.parent].head))),quat:qmul(parent.quat,q)});else poses.push({head:b.head.slice(),quat:q})}return poses}
function deformRig(o){if(!o?.rig)return;const r=o.rig,rest=r.restPositions;if(rest.length!==o.mesh.positions.length)return;
 const poses=boneTransforms(o),out=new Array(rest.length);for(let i=0;i<rest.length/3;i++){const point=rest.slice(i*3,i*3+3),w=r.weights[i],v=[0,0,0];if(!w){out.splice(i*3,3,...point);continue}for(let j=0;j<4;j++){const k=w.j[j],amount=w.w[j];if(amount<1e-6)continue;const q=poses[k],head=r.bones[k].head,posed=a3(q.head,qrot(q.quat,s3(point,head)));for(let d=0;d<3;d++)v[d]+=posed[d]*amount}for(let d=0;d<3;d++)out[i*3+d]=v[d]}
 const mesh={...o.mesh,positions:out,normals:r.restNormals.slice()};smoothNormals(mesh);o.mesh=mesh;disposeGpu(o.id)
}
function solveIK(o,idx,target,count=2,quiet=false){if(!o?.rig)return false;const bones=o.rig.bones;let chain=[],k=idx;while(k>=0&&chain.length<count){chain.unshift(k);k=bones[k].parent}if(!chain.length)return false;
 const frames=boneTransforms(o),pts=[frames[chain[0]].head.slice()];for(const j of chain)pts.push(a3(frames[j].head,qrot(frames[j].quat,s3(bones[j].tail,bones[j].head))));let lengths=chain.map(j=>len(s3(bones[j].tail,bones[j].head))),base=pts[0].slice(),total=lengths.reduce((a,b)=>a+b,0),goal=target.slice();
 if(len(s3(goal,base))>=total){let dir=unit(s3(goal,base));for(let i=0;i<chain.length;i++)pts[i+1]=a3(pts[i],m3(dir,lengths[i]))}
 else for(let iter=0;iter<20;iter++){pts[pts.length-1]=goal.slice();for(let i=chain.length-1;i>=0;i--)pts[i]=a3(pts[i+1],m3(unit(s3(pts[i],pts[i+1])),lengths[i]));pts[0]=base.slice();for(let i=0;i<chain.length;i++)pts[i+1]=a3(pts[i],m3(unit(s3(pts[i+1],pts[i])),lengths[i]));if(len(s3(pts[pts.length-1],goal))<.0002)break}
 for(let i=0;i<chain.length;i++){const j=chain[i],current=boneTransforms(o),q=current[j].quat,actual=qrot(q,s3(bones[j].tail,bones[j].head)),desired=s3(pts[i+1],pts[i]),global=qmul(qfrom(actual,desired),q),parent=bones[j].parent,local=parent<0?global:qmul(qinv(current[parent].quat),global);bones[j].rot=eulerFromQuat(local)}
 if(!quiet){deformRig(o);refresh()}return true
}
function getRigTrack(o,idx,create=true){const a=getMotion();if(create)a.rigTracks[o.id]??={};if(create)a.rigTracks[o.id][idx]??=[];return a.rigTracks[o.id]?.[idx]||[]}
function keyBone(){const o=selectRig();if(!o)return showToast('Select a rigged mesh');const a=getMotion(),idx=clamp(chosenBone,0,o.rig.bones.length-1),t=+(timelineTime).toFixed(4),keys=getRigTrack(o,idx),record={t,rot:o.rig.bones[idx].rot.slice(),ease:a.interpolation};const same=keys.findIndex(k=>Math.abs(k.t-t)<1e-4);if(same>=0)keys[same]=record;else keys.push(record);keys.sort((a,b)=>a.t-b.t);commit('Recorded bone rotation');updateMotionUI()}
function applyBoneKeys(t){const a=getMotion();for(const o of project.objects){if(!o.rig)continue;for(let j=0;j<o.rig.bones.length;j++){const keys=a.rigTracks[o.id]?.[j];if(keys?.length){const pose=poseAt(keys,t);if(pose?.rot)o.rig.bones[j].rot=pose.rot.slice()}}}}
function bonePoseAt(o,t){const a=getMotion(),out=o.rig.bones.map(b=>b.rot.slice());for(let j=0;j<out.length;j++){const keys=a.rigTracks[o.id]?.[j];if(keys?.length){let k=poseAt(keys,t);if(k?.rot)out[j]=k.rot.slice()}}return out}
function nlaLayerName(layer){return `${layer.name} (${layer.mode} · ${layer.weight.toFixed(2)})`}
function layerLocalTime(layer,t,a){const duration=Math.max(.001,layer.end-layer.start);if(t<layer.start||t>layer.end)return null;let v=(t-layer.start)*layer.speed+layer.offset;const length=Math.max(.001,layer.clipEnd-layer.clipStart);if(layer.loop)v=((v%length)+length)%length;else v=clamp(v,0,length);return layer.clipStart+v}
function blending(base,sampled,reference,weight,mode){const output=deep(base);const fields=['pos','rot','scale','color','emit','alpha'];for(const f of fields){const x=sampled[f],b=base[f],r=reference?.[f];if(x===undefined||b===undefined)continue;
  if(Array.isArray(x)&&Array.isArray(b))output[f]=b.map((v,j)=>mode==='add'?v+((x[j]||0)-(r?.[j]||0))*weight:v+(x[j]-v)*weight);
  else if(typeof x==='number'&&typeof b==='number')output[f]=mode==='add'?b+(x-(r||0))*weight:b+(x-b)*weight;
  else if(f==='color'&&typeof x==='string'&&typeof b==='string'&&mode!=='add')output[f]=hexColor(V.mix(rgb(b),rgb(x),weight));
 }if(weight>.5&&sampled.visible!==undefined)output.visible=sampled.visible;return output}
function applyNLA(t){const a=getMotion(),layers=a.nla.layers.filter(l=>!l.mute),solo=layers.some(l=>l.solo),active=solo?layers.filter(l=>l.solo):layers;
 for(const l of active){const local=layerLocalTime(l,t,a);if(local==null)continue;const w=clamp(l.weight,0,1);if(!w)continue;
  for(const [id,keys]of Object.entries(l.tracks||{})){const o=project.objects.find(o=>o.id===id),sample=poseAt(keys,local);if(!o||!sample)continue;const base={pos:o.pos,rot:o.rot,scale:o.scale,color:o.mat.color,emit:o.mat.emit,alpha:o.mat.alpha,visible:o.visible},reference=keys.length?keys[0]:base,blend=blending(base,sample,reference,w,l.mode);o.pos=blend.pos;o.rot=blend.rot;o.scale=blend.scale;o.visible=blend.visible;if(blend.color)o.mat.color=blend.color;if(Number.isFinite(blend.emit))o.mat.emit=blend.emit;if(Number.isFinite(blend.alpha))o.mat.alpha=blend.alpha}
  for(const [id,tracks]of Object.entries(l.boneTracks||{})){const o=project.objects.find(o=>o.id===id);if(!o?.rig)continue;for(const [index,keys]of Object.entries(tracks)){const bone=o.rig.bones[+index],sample=poseAt(keys,local);if(!bone||!sample?.rot)continue;const rest=keys[0]?.rot||[0,0,0];bone.rot=bone.rot.map((v,j)=>l.mode==='add'?v+(sample.rot[j]-rest[j])*w:v+(sample.rot[j]-v)*w)}}
 }
}
function addNlaLayer(){let a=getMotion(),o=getObj();if(!o)return showToast('Select an object to create an NLA clip');const boneTrack=o.rig?a.rigTracks[o.id]:null,objTrack=a.tracks[o.id];if(!objTrack?.length&&!Object.values(boneTrack||{}).some(k=>k.length))return showToast('Record object or bone keyframes first');const num=a.nla.layers.length+1;
 const layer={id:'nla_'+Date.now().toString(36)+'_'+num,name:'Action '+num,start:0,end:a.duration,clipStart:0,clipEnd:a.duration,offset:0,speed:1,weight:1,mode:'override',loop:true,mute:false,solo:false,tracks:{},boneTracks:{}};
 if(!a.nla.bases[o.id])a.nla.bases[o.id]={pos:o.pos.slice(),rot:o.rot.slice(),scale:o.scale.slice(),color:o.mat.color,emit:o.mat.emit,alpha:o.mat.alpha,visible:o.visible};if(objTrack?.length)layer.tracks[o.id]=deep(objTrack);if(boneTrack)layer.boneTracks[o.id]=deep(boneTrack);a.nla.layers.push(layer);chosenLayer=layer.id;commit('Added editable NLA action layer');updateMotionUI();return layer
}
function selectedLayer(){return getMotion().nla.layers.find(l=>l.id===chosenLayer)}
// Physics models dynamic bodies as translated AABB volumes with ground and body contact.
// The fixed-step semi-implicit integrator is deterministic for the same scene and timeline time.
function physicsBounds(o,pos){const bb=boundsOf(o.rig?{positions:o.rig.restPositions}:o.mesh);const scale=o.scale||[1,1,1];let min=bb.min.map((v,j)=>pos[j]+Math.min(v*scale[j],bb.max[j]*scale[j])),max=bb.max.map((v,j)=>pos[j]+Math.max(v*scale[j],bb.min[j]*scale[j]));return {min,max}}
function initPhysics(){const objects=project.objects.filter(o=>o.mesh&&o.body?.enabled);return Object.fromEntries(objects.map(o=>[o.id,{pos:(o.body.basePos||o.pos).slice(),vel:(o.body.velocity||[0,0,0]).slice()}]))}
function physicsStep(states,dt,p){const bodies=project.objects.filter(o=>o.mesh&&o.body?.enabled);const g=clamp(p.gravity,-100,100),ground=clamp(p.ground,-1000,1000);
 for(const o of bodies){let s=states[o.id];if(!s)continue;const b=o.body;if(b.type==='kinematic'){s.pos=o.pos.slice();s.vel=[0,0,0];continue}s.vel[2]+=g*dt;for(let j=0;j<3;j++)s.pos[j]+=s.vel[j]*dt;let a=physicsBounds(o,s.pos);
  if(a.min[2]<ground){s.pos[2]+=ground-a.min[2];s.vel[2]=Math.abs(s.vel[2])*clamp(b.bounce,0,1);s.vel[0]*=Math.max(0,1-clamp(b.friction,0,1)*dt*15);s.vel[1]*=Math.max(0,1-clamp(b.friction,0,1)*dt*15);if(Math.abs(s.vel[2])<.04)s.vel[2]=0}
 }
 // Pair AABB resolution along minimum penetration axis, impulse along contact normal.
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
  let a=bodies[i],b=bodies[j],x=states[a.id],y=states[b.id];if(!x||!y)continue;let A=physicsBounds(a,x.pos),B=physicsBounds(b,y.pos),pen=A.min.map((v,k)=>Math.min(A.max[k],B.max[k])-Math.max(v,B.min[k]));if(pen.some(v=>v<=0))continue;
  const axis=pen.indexOf(Math.min(...pen)),dir=x.pos[axis]<y.pos[axis]?-1:1,im1=a.body.type==='kinematic'?0:1/clamp(a.body.mass,.01,10000),im2=b.body.type==='kinematic'?0:1/clamp(b.body.mass,.01,10000),sum=im1+im2;if(!sum)continue;
  x.pos[axis]+=dir*(pen[axis]+.0001)*im1/sum;y.pos[axis]-=dir*(pen[axis]+.0001)*im2/sum;
  let rv=x.vel[axis]-y.vel[axis],closing=rv*dir;if(closing<0){const e=Math.min(clamp(a.body.bounce,0,1),clamp(b.body.bounce,0,1)),imp=-(1+e)*closing/sum;x.vel[axis]+=imp*dir*im1;y.vel[axis]-=imp*dir*im2}
 }
}
function applyPhysics(t){const a=getMotion(),p=a.physics;if(!p.enabled)return;const fixed=1/60;let states=initPhysics(),steps=Math.min(7200,Math.floor(t/fixed));for(let i=0;i<steps;i++)physicsStep(states,fixed,p);const remain=t-steps*fixed;if(remain>1e-6&&steps<7200)physicsStep(states,remain,p);for(const[id,s]of Object.entries(states)){const o=project.objects.find(o=>o.id===id);if(o&&o.body.type!=='kinematic')o.pos=s.pos.slice()}physicsCache={time:t,states}
}
function resetAllRigPoses(){for(const o of project.objects)if(o.rig){for(const b of o.rig.bones)b.rot=(b.baseRot||[0,0,0]).slice()}}
function applyIKMotion(t){const a=getMotion();for(const[id,targets]of Object.entries(a.ikTracks||{})){const o=project.objects.find(o=>o.id===id);if(!o?.rig)continue;
  for(const [index,clip]of Object.entries(targets)){if(!clip.keys?.length)continue;const k=poseAt(clip.keys,t);if(k?.pos)solveIK(o,Number(index),k.pos,clip.chain||2,true)}
 }}
function applyRigMotion(t){resetAllRigPoses();applyBoneKeys(t);applyNLA(t);applyIKMotion(t);for(const o of project.objects)if(o.rig)deformRig(o);applyPhysics(t)}
const originalSeek=seekTimeline;
seekTimeline=function(t){
 // Return unkeyed NLA objects to their action baseline before evaluating layers again;
 // otherwise additive and partial-weight layers would accumulate at every scrub.
 const n=getMotion().nla;for(const[id,k]of Object.entries(n.bases)){const o=project.objects.find(x=>x.id===id);if(!o||getMotion().tracks[id]?.length)continue;
  o.pos=k.pos.slice();o.rot=k.rot.slice();o.scale=k.scale.slice();o.mat.color=k.color;o.mat.emit=k.emit;o.mat.alpha=k.alpha;o.visible=k.visible}
 originalSeek(t);applyRigMotion(t);updateMotionBrief();refresh();return timelineTime};
const originalSerialize=serialize;
serialize=function(){const meshRestore=[];for(const o of project.objects)if(o.rig){meshRestore.push([o,o.mesh]);o.mesh={...o.mesh,positions:o.rig.restPositions.slice(),normals:o.rig.restNormals.slice()}}
 let raw;try{raw=JSON.parse(originalSerialize())}finally{for(const[o,mesh]of meshRestore)o.mesh=mesh}
 for(const o of raw.objects)if(o.rig){o.mesh.positions=o.rig.restPositions.slice();o.mesh.normals=o.rig.restNormals.slice();o.rig.bones.forEach(b=>{b.rot=(b.baseRot||[0,0,0]).slice()})}
 raw.animations=deep(getMotion());raw.version=4;return JSON.stringify(raw)
};
const originalLoad=loadProject;
loadProject=function(data,reset=true){originalLoad(data,reset);const a=getMotion();chosenBone=0;chosenLayer=a.nla.layers[0]?.id||'';for(const o of project.objects)if(o.rig&&o.rig.restPositions){o.mesh.positions=o.rig.restPositions.slice();o.mesh.normals=o.rig.restNormals.slice();for(const b of o.rig.bones)b.baseRot??=[0,0,0]}
 updateMotionUI();refresh()};
const originalRemove=removeSelected;
removeSelected=function(){const o=getObj();if(o){const a=getMotion();delete a.rigTracks[o.id];delete a.ikTracks[o.id];delete a.nla.bases[o.id];for(const l of a.nla.layers){delete l.tracks?.[o.id];delete l.boneTracks?.[o.id]}}
 originalRemove();updateMotionUI()};
const originalSelect=selectObject;
selectObject=function(id){originalSelect(id);chosenBone=0;updateMotionUI()};
// Draw selectable, view-correct armature overlay using the original projection math.
const priorOverlay=drawOverlay;
drawOverlay=function(){priorOverlay();if(!rigEdit)return;const o=selectRig();if(!o)return;const poses=boneTransforms(o),m=matTRS(o);for(let k=0;k<(quadMode?4:1);k++){
 const rect=paneRect(k);g2.save();g2.beginPath();g2.rect(rect.x,rect.y,rect.w,rect.h);g2.clip();for(let i=0;i<poses.length;i++){
 const b=o.rig.bones[i],p=screenP(mp(m,poses[i].head),k),tail=screenP(mp(m,a3(poses[i].head,qrot(poses[i].quat,s3(b.tail,b.head)))),k);if(!p||!tail)continue;
 g2.strokeStyle=i===chosenBone?'#ff9a2f':'#17c0c3';g2.fillStyle=i===chosenBone?'#ff9a2f':'#17c0c3';g2.lineWidth=i===chosenBone?4:2;g2.beginPath();g2.moveTo(...p);g2.lineTo(...tail);g2.stroke();g2.beginPath();g2.arc(p[0],p[1],i===chosenBone?5:3,0,Math.PI*2);g2.fill();if(i===chosenBone){g2.font='bold 12px sans-serif';g2.fillText(b.name,tail[0]+8,tail[1]-8)}
 }g2.restore()}
};
canvas.addEventListener('pointerdown',e=>{if(!rigEdit||!selectRig()||e.button!==0||!e.shiftKey)return;const o=selectRig(),rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*w/Math.max(1,rect.width),y=(e.clientY-rect.top)*h/Math.max(1,rect.height),pane=paneAt(x,y),poses=boneTransforms(o),m=matTRS(o);let nearest=Infinity,target=-1;for(let i=0;i<poses.length;i++){
 const bone=o.rig.bones[i],a=screenP(mp(m,poses[i].head),pane),b=screenP(mp(m,a3(poses[i].head,qrot(poses[i].quat,s3(bone.tail,bone.head)))),pane);if(!a||!b)continue;const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1),d=Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);if(d<nearest){nearest=d;target=i}}
 if(nearest<14&&target>=0){e.preventDefault();e.stopImmediatePropagation();chosenBone=target;updateMotionUI();refresh()}
},true);
// UI wiring. One dedicated scrollable inspector is safer than packing another horizontal strip onto the viewport.
const panel=document.createElement('section');panel.className='motion24';panel.id='motion24';panel.innerHTML=`
<div class="motion24Head"><strong>✦ MOTION LAB · 2.4</strong><span id="motionState">Ready</span></div>
<div class="motion24Tab"><button data-mtab="rig" class="active">Skeleton + IK</button><button data-mtab="nla">NLA Layers</button><button data-mtab="physics">Physics</button><button data-mtab="export">Video + GLB</button></div>
<div class="motion24Body" data-mview="rig">
 <div class="motionFields"><label>Rig preset<select id="rigTemplate"><option value="humanoid">Humanoid proportions</option><option value="quadruped">Quadruped</option><option value="chain">Articulated chain</option></select></label><label>Bind weights<select id="rigMode"><option value="smooth">Smooth envelopes</option><option value="rigid">Rigid connected shells</option></select></label><button id="rigBuild">Auto-rig selected mesh</button></div>
 <div class="motionFields"><label>Bone<select id="rigBone"></select></label><label><input type="checkbox" id="rigShow" checked> Show armature</label><label>IK chain<select id="rigChain"><option value="2">2 bones</option><option value="3">3 bones</option></select></label></div>
 <div class="motionFields"><label>X°<input id="boneRX" type="number" step="5"></label><label>Y°<input id="boneRY" type="number" step="5"></label><label>Z°<input id="boneRZ" type="number" step="5"></label><button id="boneKey">◆ Key bone</button><button id="rigRest">Rest pose</button></div>
 <div class="motionFields"><label>IK X<input type="number" id="ikX" step="0.1"></label><label>IK Y<input type="number" id="ikY" step="0.1"></label><label>IK Z<input type="number" id="ikZ" step="0.1"></label><button id="rigSolve">Solve IK</button><button id="rigKeyIK">◆ Key IK target</button><button id="rigDeleteIK">Delete IK key</button></div><div id="motionIKKeys" class="motionIKKeys"></div>
 <p class="motionHelp">Shift-click an armature line to select a bone. Rig templates infer proportional placement from selected mesh bounds, not anatomical landmarks. Bones are editable; mesh skinning is calculated on the CPU.</p>
</div>
<div class="motion24Body" data-mview="nla" hidden>
 <div class="motionFields"><button id="nlaAdd">+ Layer from selected action</button><button id="nlaRemove">Delete selected</button></div><div id="nlaRows"></div><p class="motionHelp">Override/additive mixing of editable object and bone action clips. Solo and mute control evaluation. Clips have independent time offsets, speeds, and loop settings.</p>
</div>
<div class="motion24Body" data-mview="physics" hidden>
 <div class="motionFields"><label><input type="checkbox" id="phyEnabled"> Enable physics</label><label>Gravity Z (m/s²)<input id="phyGravity" type="number" step=".1" value="-9.81"></label><label>Ground Z<input id="phyGround" type="number" step=".1" value="0"></label></div>
 <div class="motionFields"><label><input type="checkbox" id="phyBody"> Simulate selected object</label><label>Type<select id="phyType"><option value="dynamic">Dynamic</option><option value="kinematic">Kinematic</option></select></label><label>Mass (kg)<input id="phyMass" type="number" min=".01" value="1"></label><label>Bounce<input id="phyBounce" type="number" min="0" max="1" step=".05" value=".2"></label><label>Friction<input id="phyFriction" type="number" min="0" max="1" step=".05" value=".6"></label></div>
 <div class="motionFields"><label>Velocity X<input id="phyVX" type="number" value="0" step=".5"></label><label>Velocity Y<input id="phyVY" type="number" value="0" step=".5"></label><label>Velocity Z<input id="phyVZ" type="number" value="0" step=".5"></label><button id="phyReset">Set initial pose</button></div>
 <p class="motionHelp">Deterministic fixed-step AABB contact physics: gravity, mass, restitution, friction, ground contacts and box-box collision. No rotational inertia, joint forces, cloth, fluids or collision-mesh certification.</p>
</div>
<div class="motion24Body" data-mview="export" hidden>
 <div class="motionFields"><button id="rigGLBExport">Export skinned GLB</button><label>Video size<select id="mp4Size"><option value="640">640 × 360</option><option value="960">960 × 540</option><option value="1280">1280 × 720</option></select></label><label>FPS<select id="mp4FPS"><option>24</option><option>30</option></select></label><button id="mp4Export">Export MP4 (H.264)</button></div>
 <div id="mp4Status" class="motionHelp">MP4 requires H.264 in MediaRecorder or WebCodecs. WebM remains available in the main timeline. No network encoder is used.</div>
</div>`;
const timeline=$m('timelineDock');timeline?.append(panel);
const css=document.createElement('style');css.textContent=`
#timelineDock.animationV23{max-height:min(48vh,480px);overflow:auto;overscroll-behavior:contain} .motion24{border-top:1px solid var(--line);margin-top:10px;padding-top:9px;color:var(--text)}
.motion24Head{display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:11px;margin:3px 0 7px}.motion24Head span{color:var(--muted);font-weight:400}
.motion24Tab{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;padding-bottom:6px}.motion24Tab button{padding:6px 9px;font-size:10px}.motion24Tab button.active{background:var(--accent);color:#063238;font-weight:800}
.motion24Body{padding:7px;max-height:min(27vh,230px);overflow:auto;border:1px solid var(--line);border-radius:8px}.motion24Body[hidden]{display:none!important}
.motionFields{display:flex;flex-wrap:wrap;justify-content:center;align-items:end;gap:6px;margin:5px 0}.motionFields label{display:flex;gap:4px;flex-direction:column;font-size:10px;min-width:60px;color:var(--muted)}.motionFields label:has(input[type=checkbox]){flex-direction:row;align-items:center}
.motionFields input:not([type=checkbox]),.motionFields select{width:105px;max-width:150px;padding:5px;font-size:11px;min-width:0}.motionFields input[type=checkbox]{width:16px}.motionFields button{padding:6px 9px;font-size:10px;min-height:30px}
.motionIKKeys{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin:5px}.motionIKKeys button{font-size:10px;padding:4px 6px}.motionIKKeys button.active{background:var(--accent);color:#073339}
.motionHelp{font-size:10px;color:var(--muted);line-height:1.4;margin:8px 2px 3px}.nlaLayer{padding:7px;margin:6px 0;border:1px solid var(--line);border-radius:7px;background:#7d9c9e10}.nlaLayer.selected{border-color:var(--accent)}
.nlaLayerTop{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:6px}.nlaLayerTop input{max-width:180px;min-width:85px;flex:1}.nlaLayer .motionFields input{width:70px}.nlaLayer button{font-size:10px}
@media(max-width:520px){#timelineDock.animationV23{max-height:46vh}.motion24Body{max-height:22vh}.motionFields input:not([type=checkbox]),.motionFields select{width:78px}.motion24Tab button{padding:6px}}
`;document.head.append(css);
function updateMotionBrief(){const o=selectRig(),a=getMotion();if($m('motionState'))$m('motionState').textContent=`${project.objects.filter(x=>x.rig).length} rigs · ${a.nla.layers.length} NLA · ${a.physics.enabled?'physics ON':'physics OFF'}`}
function updateMotionUI(){if(!$m('motion24'))return;const o=selectRig(),bone=o?.rig.bones[chosenBone];const drop=$m('rigBone');drop.innerHTML='';for(let i=0;i<(o?.rig.bones.length||0);i++){let opt=document.createElement('option');opt.value=i;opt.textContent=i+' · '+o.rig.bones[i].name;drop.add(opt)}drop.value=chosenBone;
 for(let i=0;i<3;i++){const f=$m(['boneRX','boneRY','boneRZ'][i]);f.value=bone?.rot[i]??0;f.disabled=!bone}
 for(const[id,val]of [['ikX',bone?.tail[0]],['ikY',bone?.tail[1]],['ikZ',bone?.tail[2]]]){$m(id).value=Number.isFinite(val)?val.toFixed(3):0;$m(id).disabled=!bone}
 $m('rigShow').checked=rigEdit;
 const ikrow=$m('motionIKKeys'),ikeys=(o?.rig&&getMotion().ikTracks?.[o.id]?.[chosenBone]?.keys)||[];
 if(ikrow){ikrow.innerHTML='';if(ikeys.length){for(const k of ikeys){const btn=document.createElement('button');btn.textContent='IK '+k.t.toFixed(2)+'s';btn.classList.toggle('active',Math.abs(k.t-timelineTime)<.0001);btn.title='Jump to IK target keyframe';btn.onclick=()=>{seekTimeline(k.t);for(let j=0;j<3;j++)$m(['ikX','ikY','ikZ'][j]).value=Number(k.pos[j]).toFixed(3);updateMotionUI()};ikrow.append(btn)}}else ikrow.textContent='No IK target keys for selected bone'}
 const a=getMotion(),p=a.physics;$m('phyEnabled').checked=p.enabled;$m('phyGravity').value=p.gravity;$m('phyGround').value=p.ground;
 const body=getObj()?.body;$m('phyBody').checked=!!body?.enabled;$m('phyType').value=body?.type||'dynamic';$m('phyMass').value=body?.mass??1;$m('phyBounce').value=body?.bounce??.2;$m('phyFriction').value=body?.friction??.6;
 for(let i=0;i<3;i++)$m(['phyVX','phyVY','phyVZ'][i]).value=body?.velocity?.[i]??0;
 renderNLA();updateMotionBrief()
}
function renderNLA(){const div=$m('nlaRows');if(!div)return;div.innerHTML='';const a=getMotion();for(const l of a.nla.layers){const row=document.createElement('div');row.className='nlaLayer'+(chosenLayer===l.id?' selected':'');row.innerHTML=`<div class="nlaLayerTop"><input aria-label="Layer name" data-f="name" value="${escapeHtml(l.name)}"><label><input type="checkbox" data-f="mute" ${l.mute?'checked':''}>Mute</label><label><input type="checkbox" data-f="solo" ${l.solo?'checked':''}>Solo</label><button data-pick="1">Edit</button></div><div class="motionFields"><label>Blend<select data-f="mode"><option value="override" ${l.mode==='override'?'selected':''}>Override</option><option value="add" ${l.mode==='add'?'selected':''}>Additive</option></select></label>${[['weight','Weight'],['start','Start'],['end','End'],['offset','Offset'],['speed','Speed']].map(([f,label])=>`<label>${label}<input type="number" data-f="${f}" step="0.1" value="${l[f]}"></label>`).join('')}<label><input type="checkbox" data-f="loop" ${l.loop?'checked':''}>Loop clip</label></div>`;
 row.querySelector('[data-pick]').onclick=()=>{chosenLayer=l.id;renderNLA()};row.querySelectorAll('[data-f]').forEach(input=>input.onchange=()=>{const f=input.dataset.f;if(input.type==='checkbox')l[f]=input.checked;else if(input.type==='number')l[f]=Number(input.value);else l[f]=input.value;if(f==='weight')l.weight=clamp(l.weight,0,1);if(f==='speed')l.speed=clamp(l.speed,.01,10);if(f==='end')l.end=Math.max(l.start+.01,l.end);chosenLayer=l.id;commit('Edited NLA '+f);seekTimeline(timelineTime);renderNLA()});div.append(row)}
 if(!a.nla.layers.length)div.innerHTML='<p class="motionHelp">No NLA clips yet. Keyframe an object or bone, then choose “+ Layer from selected action.”</p>'
}
panel.querySelectorAll('[data-mtab]').forEach(b=>b.onclick=()=>{panel.querySelectorAll('[data-mtab]').forEach(x=>x.classList.toggle('active',x===b));panel.querySelectorAll('[data-mview]').forEach(x=>x.hidden=x.dataset.mview!==b.dataset.mtab);updateMotionUI();setTimeout(()=>resizeCanvas(true),0)});
$m('rigBuild').onclick=()=>rigObject($m('rigTemplate').value,$m('rigMode').value);
$m('rigBone').onchange=()=>{chosenBone=+$m('rigBone').value;updateMotionUI();refresh()};
$m('rigShow').onchange=()=>{rigEdit=$m('rigShow').checked;refresh()};
for(let axis=0;axis<3;axis++)$m(['boneRX','boneRY','boneRZ'][axis]).onchange=e=>{const o=selectRig();if(!o)return;o.rig.bones[chosenBone].rot[axis]=Number(e.target.value)||0;deformRig(o);commit('Rotated skeletal bone');refresh()};
$m('boneKey').onclick=keyBone;
$m('rigRest').onclick=()=>{const o=selectRig();if(!o)return;for(const b of o.rig.bones)b.rot=[0,0,0];deformRig(o);commit('Restored armature rest pose');updateMotionUI()};
$m('rigKeyIK').onclick=()=>{const o=selectRig();if(!o)return showToast('Select a rigged mesh');const a=getMotion(),idx=chosenBone,t=+timelineTime.toFixed(4),pos=['ikX','ikY','ikZ'].map(id=>Number($m(id).value)||0);a.ikTracks[o.id]??={};const clip=a.ikTracks[o.id][idx]??={chain:+$m('rigChain').value,keys:[]};clip.chain=+$m('rigChain').value;const key={t,pos,ease:a.interpolation},same=clip.keys.findIndex(k=>Math.abs(k.t-t)<.0001);if(same>=0)clip.keys[same]=key;else clip.keys.push(key);clip.keys.sort((a,b)=>a.t-b.t);commit('Recorded IK target keyframe');showToast('IK target keyed at '+t.toFixed(2)+'s');updateMotionUI()};
$m('rigDeleteIK').onclick=()=>{const o=selectRig();if(!o)return;const a=getMotion(),keys=a.ikTracks?.[o.id]?.[chosenBone]?.keys;if(!keys?.length)return showToast('No IK keys for this bone');const index=keys.findIndex(k=>Math.abs(k.t-timelineTime)<Math.max(.045,.55/a.fps));if(index<0)return showToast('Select an IK key marker first');keys.splice(index,1);commit('Deleted IK target keyframe');updateMotionUI();seekTimeline(timelineTime)};
$m('rigSolve').onclick=()=>{const o=selectRig();if(!o)return;const target=['ikX','ikY','ikZ'].map(id=>Number($m(id).value)||0);solveIK(o,chosenBone,target,+$m('rigChain').value);commit('Solved skeletal IK target');updateMotionUI()};
$m('nlaAdd').onclick=addNlaLayer;$m('nlaRemove').onclick=()=>{const a=getMotion(),i=a.nla.layers.findIndex(l=>l.id===chosenLayer);if(i<0)return showToast('Select an NLA layer');a.nla.layers.splice(i,1);chosenLayer=a.nla.layers[0]?.id||'';commit('Removed NLA layer');seekTimeline(timelineTime);renderNLA()};
$m('phyEnabled').onchange=e=>{getMotion().physics.enabled=e.target.checked;commit('Toggled physics');seekTimeline(timelineTime);updateMotionUI()};
for(const[id,key]of [['phyGravity','gravity'],['phyGround','ground']])$m(id).onchange=e=>{getMotion().physics[key]=Number(e.target.value)||0;commit('Edited physics environment');seekTimeline(timelineTime)};
function setBody(){const o=getObj();if(!o)return showToast('Select a mesh object for physics');const old=o.body||{};o.body={enabled:$m('phyBody').checked,type:$m('phyType').value,mass:clamp($m('phyMass').value,.01,10000),bounce:clamp($m('phyBounce').value,0,1),friction:clamp($m('phyFriction').value,0,1),velocity:['phyVX','phyVY','phyVZ'].map(id=>Number($m(id).value)||0),basePos:old.basePos||o.pos.slice()};commit('Changed rigid body physics');seekTimeline(timelineTime);updateMotionUI()}
for(const id of ['phyBody','phyType','phyMass','phyBounce','phyFriction','phyVX','phyVY','phyVZ'])$m(id).onchange=setBody;
$m('phyReset').onclick=()=>{const o=getObj();if(!o?.body)return;const a=getMotion(),prior=a.physics.enabled;a.physics.enabled=false;seekTimeline(0);o.body.basePos=o.pos.slice();a.physics.enabled=prior;commit('Set rigid body start position');seekTimeline(timelineTime)};
const originalUpdateTimelineUI=updateTimelineUI;
updateTimelineUI=function(){originalUpdateTimelineUI();updateMotionBrief()};
window.SPATIAL_MOTION_TEST={rigObject,solveIK,boneTransforms,deformRig,autoWeights,shellComponents,getMotion,applyRigMotion,addNlaLayer,selectRig,ikTracks:()=>getMotion().ikTracks,selectBone:n=>{chosenBone=n;updateMotionUI()},keyBone,rigTrack:getRigTrack,refreshUI:updateMotionUI,seek:t=>seekTimeline(t)};
// MP4 and skinned GLB export modules install below and register on this API.
updateMotionUI();
})();
