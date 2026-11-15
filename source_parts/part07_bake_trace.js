/* SPATIAL SKETCH 2.1 — UV atlas + actual ray-tested ambient occlusion, object-space normals,
   and an optional progressive offline Monte Carlo path tracer. */
function transformedTriangles(objects=project.objects,limit=18000){let tris=[];
 for(let o of objects){if(!o.visible||!o.mesh)continue;let m=o.mesh,M=matTRS(o),ii=m.indices,ps=m.positions;if(tris.length+ii.length/3>limit)throw Error('Ray tracing budget exceeded ('+limit+' triangles). Hide complex parts or reduce tessellation.');for(let k=0;k<ii.length;k+=3){let p=[0,1,2].map(j=>mp(M,ps.slice(ii[k+j]*3,ii[k+j]*3+3))),n=V.cross(V.sub(p[1],p[0]),V.sub(p[2],p[0]));if(V.len(n)<1e-9)continue;let mins=[0,1,2].map(d=>Math.min(...p.map(q=>q[d]))),maxs=[0,1,2].map(d=>Math.max(...p.map(q=>q[d])));tris.push({p,n:V.norm(n),min:mins,max:maxs,center:V.scale(V.add(V.add(p[0],p[1]),p[2]),1/3),mat:o.mat||MAT.paint})}}return tris}
function buildBVH(tris,maxLeaf=10){let all=tris.map((_,i)=>i),nodes=[];
 function rec(ids){let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let id of ids){let tr=tris[id];for(let d=0;d<3;d++){lo[d]=Math.min(lo[d],tr.min[d]);hi[d]=Math.max(hi[d],tr.max[d])}}
 let n=nodes.length;nodes.push(null);if(ids.length<=maxLeaf){nodes[n]={lo,hi,ids};return n}
 let ext=V.sub(hi,lo),axis=ext.indexOf(Math.max(...ext));ids.sort((a,b)=>tris[a].center[axis]-tris[b].center[axis]);let mid=ids.length>>1;if(!mid||mid===ids.length){nodes[n]={lo,hi,ids};return n}
 let left=rec(ids.slice(0,mid)),right=rec(ids.slice(mid));nodes[n]={lo,hi,left,right};return n}
 if(tris.length)rec(all);return{tris,nodes};
}
function rayAABB(o,d,lo,hi,maxT){let tmin=1e-5,tmax=maxT;for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-12){if(o[i]<lo[i]||o[i]>hi[i])return false;continue}let a=(lo[i]-o[i])/d[i],b=(hi[i]-o[i])/d[i];if(a>b)[a,b]=[b,a];tmin=Math.max(tmin,a);tmax=Math.min(tmax,b);if(tmax<tmin)return false}return true}
function hitBVH(bvh,o,d,maxDist=1e7,ignore=-1){let nodes=bvh.nodes,tris=bvh.tris;if(!nodes.length)return null;let stack=[0],best=maxDist,hitted=null;
 while(stack.length){let idx=stack.pop(),n=nodes[idx];if(!rayAABB(o,d,n.lo,n.hi,best))continue;if(n.ids){for(let j of n.ids){if(j===ignore)continue;let tr=tris[j],edge1=V.sub(tr.p[1],tr.p[0]),edge2=V.sub(tr.p[2],tr.p[0]),p=V.cross(d,edge2),det=V.dot(edge1,p);if(Math.abs(det)<1e-10)continue;let inv=1/det,t=V.sub(o,tr.p[0]),u=V.dot(t,p)*inv;if(u<0||u>1)continue;let q=V.cross(t,edge1),v=V.dot(d,q)*inv;if(v<0||u+v>1)continue;let dist=V.dot(edge2,q)*inv;if(dist>1e-5&&dist<best){best=dist;hitted={tri:tr,index:j,t:dist,pos:V.add(o,V.scale(d,dist))}}}}else{stack.push(n.left,n.right)}}return hitted
}
const BAKED_MAPS=['albedo','normal','ao'];
async function bakeSelectedMaps(){let o=getObj();if(!o?.mesh)throw Error('Select a mesh to bake');let m=o.mesh,count=m.indices.length/3;if(count>2400)throw Error('Baking limited to 2,400 source triangles. Simplify geometry or bake parts individually.');if(count<1)throw Error('Empty mesh');let size=Math.max(128,Math.min(2048,Number($('bakeSize').value)||512)),grid=Math.ceil(Math.sqrt(count)),cell=size/grid;
 if(cell<3)throw Error('Texture resolution too small for atlas');let canvases={};for(let name of BAKED_MAPS){let c=document.createElement('canvas');c.width=c.height=size;canvases[name]=c}
 let atlas=clone(m);atlas.uvs=Array(m.positions.length/3*2).fill(0);let locTris=transformedTriangles([{...o,pos:[0,0,0],rot:[0,0,0],scale:[1,1,1],visible:true}],2400),bvh=buildBVH(locTris);const aoRays=Math.max(4,Math.min(20,Number($('bakeRays').value)||8));
 const sampleHemisphere=(n,i,count)=>{let z=(i+.6)/count,a=i*2.39996323,radial=Math.sqrt(1-z*z),ref=Math.abs(n[2])<.9?[0,0,1]:[1,0,0],u=V.norm(V.cross(ref,n)),v=V.cross(n,u);return V.norm(V.add(V.scale(n,z),V.add(V.scale(u,radial*Math.cos(a)),V.scale(v,radial*Math.sin(a)))))};
 $('bakeBtn').disabled=true;const bgColor=rgb(o.mat.color),pattern=o.mat.pattern||0;
 try{for(let k=0;k<count;k++){
 let a=m.indices[k*3],b=m.indices[k*3+1],c=m.indices[k*3+2],r=Math.floor(k/grid),col=k%grid,pad=Math.max(.6,cell*.06);
 let u=[[(col*cell+pad)/size,(r*cell+pad)/size],[((col+1)*cell-pad)/size,(r*cell+pad)/size],[(col*cell+pad)/size,((r+1)*cell-pad)/size]];
 for(let j=0;j<3;j++){let ix=m.indices[k*3+j];atlas.uvs[ix*2]=u[j][0];atlas.uvs[ix*2+1]=1-u[j][1]}
 let tr=locTris[k];if(!tr)continue;let n=tr.n,origin=V.add(tr.center,V.scale(n,.002)),blocked=0;
 for(let i=0;i<aoRays;i++)if(hitBVH(bvh,origin,sampleHemisphere(n,i,aoRays),Number($('bakeRadius').value)||3,k))blocked++;
 let ambient=1-blocked/aoRays,albedo=bgColor.slice(),uv=tr.center;
 if(pattern===1)albedo=albedo.map(z=>z*(.89+.11*Math.sin((uv[0]+uv[1]+uv[2])*95)));
 if(pattern===2)albedo=albedo.map(z=>z*(.87+.13*Math.sin(uv[0]*35)*Math.cos(uv[1]*37)));
 let colors={albedo:albedo.map(z=>Math.round(z*255)),normal:n.map(z=>Math.round((z*.5+.5)*255)),ao:[Math.round(ambient*255),Math.round(ambient*255),Math.round(ambient*255)]};
 for(let type of BAKED_MAPS){let ctx=canvases[type].getContext('2d');let points=u.map(q=>[q[0]*size,q[1]*size]);ctx.beginPath();ctx.moveTo(...points[0]);ctx.lineTo(...points[1]);ctx.lineTo(...points[2]);ctx.closePath();ctx.fillStyle='rgb('+colors[type].join(',')+')';ctx.fill();ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=Math.max(1,cell*.055);ctx.stroke()}
 if(k%24===0){$('bakeProgress').textContent='Sampling '+(k+1)+' / '+count+' triangles · '+Math.round((k+1)/count*100)+'%';await new Promise(requestAnimationFrame)}
 }
 // Triangle atlas duplicates every original triangle vertex; avoid shared-index UV overwrites.
 let newm=newMesh();for(let i=0;i<m.indices.length;i++){let a=m.indices[i],j=newm.positions.length/3;newm.positions.push(...m.positions.slice(a*3,a*3+3));newm.normals.push(...m.normals.slice(a*3,a*3+3));newm.uvs.push(...atlas.uvs.slice(a*2,a*2+2));newm.indices.push(j)}
 // Regenerate non-overlapping triangle UVs unconditionally; source meshes can share vertices.
 for(let k=0;k<count;k++){let r=Math.floor(k/grid),col=k%grid,pad=Math.max(.6,cell*.06),u=[[(col*cell+pad)/size,(r*cell+pad)/size],[((col+1)*cell-pad)/size,(r*cell+pad)/size],[(col*cell+pad)/size,((r+1)*cell-pad)/size]];for(let t=0;t<3;t++){newm.uvs[(k*3+t)*2]=u[t][0];newm.uvs[(k*3+t)*2+1]=1-u[t][1]}}
 o.mesh=newm;disposeGpu(o.id);o.bake={size,triangleCount:count,rays:aoRays,kind:'triangle atlas',space:'normal:object',maps:Object.fromEntries(BAKED_MAPS.map(name=>[name,canvases[name].toDataURL('image/png')]))};commit('Baked UV atlas, albedo, object-space normals and ray-tested AO');$('bakeProgress').textContent='Finished: '+count+' triangles';viewBakeResults(o);
 }finally{$('bakeBtn').disabled=false}
}
function viewBakeResults(o=getObj()){if(!o?.bake)return showToast('Bake maps for an object first');let tiles=BAKED_MAPS.map(name=>'<div style="text-align:center;min-width:0"><strong>'+name.toUpperCase()+'</strong><img style="display:block;width:100%;height:auto;aspect-ratio:1;background:#aaa;margin:8px 0;border:1px solid var(--line)" src="'+o.bake.maps[name]+'"><button data-map="'+name+'">Save PNG</button></div>').join('');modal('Baked PBR atlas · '+escapeHtml(o.name),'<p>UV triangle atlas · '+o.bake.size+'² · '+o.bake.triangleCount+' triangles. Normals are <strong>object-space</strong>; AO uses actual geometric visibility rays. Texture atlases are stored in the native project.</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px">'+tiles+'</div>');$('modalContent').querySelectorAll('[data-map]').forEach(b=>b.onclick=()=>{let type=b.dataset.map,a=document.createElement('a');a.href=o.bake.maps[type];a.download=safeName(o.name)+'_'+type+'.png';a.click()})}
// Stochastic Monte Carlo path tracing, diffuse and rough specular paths, direct area-light shadow tests.
function skyColor(dir){let t=Math.max(0,Math.min(1,dir[2]*.5+.5));return [0.40+.36*t,0.44+.37*t,0.51+.36*t]}
function sampleCosine(n){let a=Math.random()*6.2831853,z=Math.sqrt(Math.random()),r=Math.sqrt(1-z*z),h=Math.abs(n[2])>.89?[0,1,0]:[0,0,1],u=V.norm(V.cross(h,n)),v=V.cross(n,u);return V.norm(V.add(V.scale(n,z),V.add(V.scale(u,Math.cos(a)*r),V.scale(v,Math.sin(a)*r))))}
function reflectDir(d,n){return V.sub(d,V.scale(n,2*V.dot(d,n)))}
function tracePath(bvh,origin,dir,bounces){let radiance=[0,0,0],throughput=[1,1,1];
 for(let depth=0;depth<bounces;depth++){
  let hit=hitBVH(bvh,origin,dir);if(!hit){let sky=skyColor(dir);for(let i=0;i<3;i++)radiance[i]+=throughput[i]*sky[i]*(depth===0?1:.7);break}
  let {tri,pos}=hit,mat=tri.mat,N=V.dot(tri.n,dir)>0?V.scale(tri.n,-1):tri.n,albedo=rgb(mat.color),metal=Math.min(1,mat.metal||0),rough=Math.max(.035,mat.rough||.5);
  for(let i=0;i<3;i++)radiance[i]+=throughput[i]*albedo[i]*(mat.emit||0)*2;
  // Rectangle area light over scene; deliberately stochastic for soft penumbra.
  let lp=[-5+Math.random()*4,-4+Math.random()*4,12],ld=V.sub(lp,pos),dist=V.len(ld),L=V.scale(ld,1/dist),nl=Math.max(0,V.dot(N,L));
  if(nl>0&&!hitBVH(bvh,V.add(pos,V.scale(N,.003)),L,dist-.01)){let intensity=5/(1+.018*dist*dist),hl=V.norm(V.sub(L,dir)),spec=Math.pow(Math.max(0,V.dot(N,hl)),Math.max(2,3/(rough*rough)))*metal*1.5;for(let i=0;i<3;i++)radiance[i]+=throughput[i]*(albedo[i]*(1-metal)*nl*.36+spec)*intensity}
  let glass=(mat.alpha??1)<.7;if(glass){dir=V.norm(V.add(dir,V.scale(sampleCosine(N),rough*.08)));origin=V.add(pos,V.scale(dir,.005));for(let i=0;i<3;i++)throughput[i]*=.92*albedo[i]+.08;continue}
  if(Math.random()<metal*.78){dir=V.norm(V.add(reflectDir(dir,N),V.scale(sampleCosine(N),rough*.52)));if(V.dot(dir,N)<0)dir=reflectDir(dir,N);for(let i=0;i<3;i++)throughput[i]*=Math.max(.06,albedo[i])}
  else{dir=sampleCosine(N);for(let i=0;i<3;i++)throughput[i]*=Math.max(.01,albedo[i])*(1-metal*.35)}
  origin=V.add(pos,V.scale(N,.004));if(depth>=2){let q=Math.max(.15,Math.min(.95,Math.max(...throughput)));if(Math.random()>q)break;throughput=throughput.map(x=>x/q)}
 }
 return radiance
}
let traceCancelled=false;
async function pathtraceRender(){let W=Math.max(160,Math.min(1600,Number($('traceWidth').value)||480)),H=Math.max(120,Math.min(1000,Number($('traceHeight').value)||300)),spp=Math.max(1,Math.min(64,Number($('traceSamples').value)||6)),bounces=Math.max(1,Math.min(6,Number($('traceBounces').value)||3));if(W*H*spp>35e6)throw Error('Render exceeds the 35-million-sample safety limit. Reduce resolution or samples.');
 let tris=transformedTriangles(),bvh=buildBVH(tris),c=clone(cams[activePane]),basis=cameraBasis(c),fovTan=Math.tan(rad(c.fov)/2),aspect=W/H,orthoMode=c.kind!=='perspective';traceCancelled=false;
 modal('Offline path tracing · CPU progressive','<p id="traceProgress">Building acceleration hierarchy · '+tris.length+' triangles</p><canvas id="traceOutput" style="width:100%;height:auto;max-height:64vh;object-fit:contain;background:#21343a" width="'+W+'" height="'+H+'"></canvas><div class="group" style="margin-top:10px"><button id="traceCancel">Cancel</button><button id="traceSave" class="action" disabled>Save PNG</button></div><p class="hint">Monte Carlo sample integration with soft shadow-ray tests, multiple bounces and rough reflections. CPU preview, not a verified production path tracer.</p>');$('modalContent').parentElement.style.zIndex='20';
 const oc=$('traceOutput'),ctx=oc.getContext('2d'),data=ctx.createImageData(W,H),tot=W*H*3,acc=new Float32Array(tot),progress=$('traceProgress'),save=$('traceSave');$('traceCancel').onclick=()=>{traceCancelled=true;progress.textContent='Render cancelled'};
 try{for(let s=0;s<spp&&!traceCancelled;s++){
 for(let y=0;y<H&&!traceCancelled;y++){
 for(let x=0;x<W;x++){let nx=((x+Math.random())/W*2-1),ny=1-(y+Math.random())/H*2,origin=basis.eye.slice(),dir;
 if(orthoMode){origin=V.add(basis.eye,V.add(V.scale(basis.r,nx*c.scale*aspect),V.scale(basis.u,ny*c.scale)));dir=basis.f.slice()}
 else dir=V.norm(V.add(basis.f,V.add(V.scale(basis.r,nx*fovTan*aspect),V.scale(basis.u,ny*fovTan))));
 let col=tracePath(bvh,origin,dir,bounces),ix=(y*W+x)*3;for(let j=0;j<3;j++)acc[ix+j]+=Math.min(25,col[j])}
 if(y%12===11||y===H-1){for(let yy=Math.max(0,y-11);yy<=y;yy++)for(let x=0;x<W;x++){let p=(yy*W+x),a=p*3,b=p*4;for(let j=0;j<3;j++){let linear=acc[a+j]/(s+1),mapped=linear/(1+linear);data.data[b+j]=Math.max(0,Math.min(255,Math.pow(mapped,1/2.2)*255))}data.data[b+3]=255}ctx.putImageData(data,0,0);progress.textContent='Tracing '+(s+1)+' / '+spp+' samples per pixel · row '+(y+1)+' / '+H+' · '+tris.length+' triangles';await new Promise(requestAnimationFrame)}
 }
 }
 if(!traceCancelled){progress.textContent='Completed '+W+' × '+H+' · '+spp+' spp · '+bounces+' bounces';save.disabled=false;save.onclick=()=>oc.toBlob(blob=>downloadBlob(blob,safeName(project.name)+'_pathtrace.png'),'image/png')}
 }catch(e){progress.textContent='Render error: '+e.message;throw e}
}
