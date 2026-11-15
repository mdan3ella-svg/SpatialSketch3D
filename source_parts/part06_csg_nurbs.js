/* SPATIAL SKETCH 3D 2.0 — Offline mesh-Boolean / rational NURBS geometry.
   BSP construction uses polygon plane splitting; it is not an exact CAD B-rep kernel. */
const ADV={operandA:null,operandB:null,activeRender:null,bake:null,draw:null};
const EPS_CSG=1e-5;
function solidReport(mesh){
 if(!mesh?.indices?.length)return{closed:false,reason:'No triangles',volume:0,boundary:0};
 if(mesh.indices.length>24000)return{closed:false,reason:'Limit: 8,000 triangles per operand',volume:0,boundary:0};
 const counts=new Map(),ps=mesh.positions,ii=mesh.indices;
 let volume=0;
 const key=i=>ps.slice(i*3,i*3+3).map(a=>Math.round(a*1e5)).join('/');
 for(let i=0;i<ii.length;i+=3){let a=ii[i],b=ii[i+1],c=ii[i+2],A=ps.slice(a*3,a*3+3),B=ps.slice(b*3,b*3+3),C=ps.slice(c*3,c*3+3);
  if(!A.every(Number.isFinite)||!B.every(Number.isFinite)||!C.every(Number.isFinite))return{closed:false,reason:'Nonfinite vertex',volume:0,boundary:0};
  if(V.len(V.cross(V.sub(B,A),V.sub(C,A)))<1e-9)return{closed:false,reason:'Degenerate triangle',volume:0,boundary:0};
  volume+=V.dot(A,V.cross(B,C))/6;
  let keys=[key(a),key(b),key(c)];for(let j=0;j<3;j++){let e=[keys[j],keys[(j+1)%3]].sort().join('|');counts.set(e,(counts.get(e)||0)+1)}
 }
 let bad=[...counts.values()].filter(x=>x!==2).length;
 return{closed:bad===0,reason:bad?'Nonmanifold boundary/edges: '+bad:'Closed triangulated shell',volume,boundary:bad};
}
class FCPlane{
 constructor(n,w){this.n=n;this.w=w}
 static from(poly){let n=V.norm(V.cross(V.sub(poly[1],poly[0]),V.sub(poly[2],poly[0])));return new FCPlane(n,V.dot(n,poly[0]))}
 flip(){this.n=V.scale(this.n,-1);this.w=-this.w}
 split(p,cf,cb,front,back){const C=0,F=1,B=2,S=3;let types=[],t=0;
  for(let v of p.v){let d=V.dot(this.n,v)-this.w,q=d < -EPS_CSG?B:d>EPS_CSG?F:C;t|=q;types.push(q)}
  if(t===C){(V.dot(this.n,p.plane.n)>0?cf:cb).push(p)}else if(t===F)front.push(p);else if(t===B)back.push(p);else{
   let f=[],b=[];for(let j=0;j<p.v.length;j++){let k=(j+1)%p.v.length,a=p.v[j],z=p.v[k],ta=types[j],tz=types[k];if(ta!==B)f.push(a);if(ta!==F)b.push(a);if((ta|tz)===S){let d=V.sub(z,a),dot=V.dot(this.n,d);if(Math.abs(dot)<1e-12)continue;let r=(this.w-V.dot(this.n,a))/dot,q=V.add(a,V.scale(d,r));f.push(q);b.push(q)}}
   if(f.length>2)front.push(new FCPoly(f,p.tag));if(b.length>2)back.push(new FCPoly(b,p.tag))
  }
 }
}
class FCPoly{constructor(v,tag=0){this.v=v;this.tag=tag;this.plane=FCPlane.from(v)}clone(){return new FCPoly(this.v.map(p=>p.slice()),this.tag)}flip(){this.v.reverse();this.plane.flip()}}
class FCNode{
 constructor(polys=[]){this.plane=null;this.front=null;this.back=null;this.polys=[];if(polys.length)this.build(polys)}
 clone(){let n=new FCNode();n.plane=this.plane&&new FCPlane(this.plane.n.slice(),this.plane.w);n.front=this.front?.clone()||null;n.back=this.back?.clone()||null;n.polys=this.polys.map(p=>p.clone());return n}
 invert(){for(let p of this.polys)p.flip();this.plane?.flip();this.front?.invert();this.back?.invert();let t=this.front;this.front=this.back;this.back=t}
 clipPolygons(polys){if(!this.plane)return polys.slice();let front=[],back=[];for(let p of polys)this.plane.split(p,front,back,front,back);if(this.front)front=this.front.clipPolygons(front);if(this.back)back=this.back.clipPolygons(back);else back=[];return front.concat(back)}
 clipTo(node){this.polys=node.clipPolygons(this.polys);this.front?.clipTo(node);this.back?.clipTo(node)}
 all(){return [...this.polys,...(this.front?.all()||[]),...(this.back?.all()||[])]}
 build(polys){if(!polys.length)return;if(!this.plane)this.plane=FCPlane.from(polys[0].v);let f=[],b=[];for(let p of polys)this.plane.split(p,this.polys,this.polys,f,b);if(f.length){this.front??=new FCNode();this.front.build(f)}if(b.length){this.back??=new FCNode();this.back.build(b)}}
}
function csgPolys(obj,tag){let m=obj.mesh,t=matTRS(obj),flip=solidReport(m).volume<0,polys=[];for(let k=0;k<m.indices.length;k+=3){let v=[0,1,2].map(j=>mp(t,m.positions.slice(m.indices[k+j]*3,m.indices[k+j]*3+3)));if(flip)v.reverse();polys.push(new FCPoly(v,tag))}return polys}
function bspBoolean(polya,polyb,mode){let a=new FCNode(polya.map(p=>p.clone())),b=new FCNode(polyb.map(p=>p.clone()));
 if(mode==='union'){a.clipTo(b);b.clipTo(a);b.invert();b.clipTo(a);b.invert();a.build(b.all())}
 else if(mode==='subtract'){a.invert();a.clipTo(b);b.clipTo(a);b.invert();b.clipTo(a);b.invert();a.build(b.all());a.invert()}
 else if(mode==='intersect'){a.invert();b.clipTo(a);b.invert();a.clipTo(b);b.clipTo(a);a.build(b.all());a.invert()}
 else throw Error('Unknown Boolean operation');return a.all();
}
function csgToMesh(polygons){
 // Resolve T-junctions created by BSP splitting: insert every vertex which lies
 // along a polygon edge before triangulation. Fan from the polygon centroid so
 // each split boundary segment participates in a nondegenerate triangle.
 let m=newMesh(),seen=new Map(),key=p=>p.map(v=>Math.round(v*1e5)).join('/');
 for(let poly of polygons)for(let v of poly.v)seen.set(key(v),v);
 let vertices=[...seen.values()],allowStitch=vertices.length<=6500;
 for(let p of polygons){if(p.v.length>300)throw Error('Polygon too complex');let ring=[];
  for(let j=0;j<p.v.length;j++){
   let a=p.v[j],b=p.v[(j+1)%p.v.length],delta=V.sub(b,a),len2=V.dot(delta,delta),extra=[];ring.push(a);
   if(!allowStitch||len2<1e-12)continue;
   let axis=delta.map(Math.abs).indexOf(Math.max(...delta.map(Math.abs))),lo=Math.min(a[axis],b[axis])-1e-5,hi=Math.max(a[axis],b[axis])+1e-5;
   for(let v of vertices){if(v[axis]<lo||v[axis]>hi)continue;let t=V.dot(V.sub(v,a),delta)/len2;if(t<1e-5||t>1-1e-5)continue;
    if(V.dist(V.add(a,V.scale(delta,t)),v)<Math.max(2e-5,Math.sqrt(len2)*1e-6))extra.push({t,p:v})}
   extra.sort((x,y)=>x.t-y.t);for(let v of extra)if(V.dist(ring[ring.length-1],v.p)>1e-6)ring.push(v.p)
  }
  if(ring.length<3)continue;
  let center=V.scale(ring.reduce((sum,v)=>V.add(sum,v),[0,0,0]),1/ring.length),n=p.plane.n,bb=basisForPlane(n);
  for(let j=0;j<ring.length;j++){
   let a=ring[j],b=ring[(j+1)%ring.length],n0=V.cross(V.sub(a,center),V.sub(b,center));if(V.len(n0)<1e-9)continue;
   let t=[center,a,b];if(V.dot(n0,n)<0)t=[center,b,a];let uv=t.map(v=>[V.dot(v,bb.u)*.5,V.dot(v,bb.v)*.5]);face(m,t[0],t[1],t[2],uv[0],uv[1],uv[2])
  }
 }return m;
}
function booleanMesh(a,b,mode){let ra=solidReport(a.mesh),rb=solidReport(b.mesh);if(!ra.closed||!rb.closed)throw Error('Boolean requires two closed manifold meshes. A: '+ra.reason+'; B: '+rb.reason);let polys=bspBoolean(csgPolys(a,0),csgPolys(b,1),mode);if(polys.length>30000)throw Error('Result exceeds browser Boolean complexity budget');let m=csgToMesh(polys);if(!m.indices.length)throw Error('Boolean result is empty. Check overlap or choose another operation.');return m}
function operandSet(which){let o=getObj();if(!o?.mesh)return showToast('Select a solid mesh in the outliner first');ADV[which]=o.id;let label=which==='operandA'?'csgAName':'csgBName';$(label).textContent=o.name;showToast('Operand '+(which==='operandA'?'A':'B')+' → '+o.name)}
function booleanSelected(mode){let a=project.objects.find(o=>o.id===ADV.operandA),b=project.objects.find(o=>o.id===ADV.operandB);if(!a||!b||a===b)return showToast('Choose two different solids using Set A and Set B');try{let result=booleanMesh(a,b,mode),obj=newObj(a.name+' '+{union:'∪',subtract:'−',intersect:'∩'}[mode]+' '+b.name,'boolean',result,{operation:mode,operandA:a.id,operandB:b.id,kernel:'polygon-BSP'},'paint');obj.mat=clone(a.mat);a.visible=false;b.visible=false;add(obj);selectObject(obj.id);commit('BSP mesh '+mode+' completed; sources preserved hidden');}catch(e){modal('Boolean operation rejected','<p>'+escapeHtml(e.message)+'</p><p>This edition computes polygon-based CSG; it is not an exact CAD B-rep Boolean. An optional native CAD backend is provided separately.</p>')}}
function rebuildBoolean(){let o=getObj();if(o?.kind!=='boolean')return;let a=project.objects.find(q=>q.id===o.params.operandA),b=project.objects.find(q=>q.id===o.params.operandB);if(!a||!b)return showToast('One or both source objects missing');try{o.mesh=booleanMesh(a,b,o.params.operation);disposeGpu(o.id);commit('Boolean updated from source solids')}catch(e){showToast(e.message)}}
// Rational B-spline curves and tensor-product patches. Domain [0,1]; open-clamped knot vectors.
function knotVector(num,degree){let n=num-1,kn=[];for(let i=0;i<=n+degree+1;i++)kn.push(i<=degree?0:i>=n+1?1:(i-degree)/(n-degree+1));return kn}
function bsplineBasis(i,p,t,kn){if(p===0)return(kn[i]<=t&&t<kn[i+1])||(t===1&&kn[i+1]===1&&kn[i]<1)?1:0;let u=0,v=0,d1=kn[i+p]-kn[i],d2=kn[i+p+1]-kn[i+1];if(d1>0)u=(t-kn[i])/d1*bsplineBasis(i,p-1,t,kn);if(d2>0)v=(kn[i+p+1]-t)/d2*bsplineBasis(i+1,p-1,t,kn);return u+v}
function nurbsPoint(controls,weights,degree,t,knots){let num=controls.length,p=Math.max(1,Math.min(num-1,degree)),kn=knots||knotVector(num,p),w=0,v=[0,0,0];for(let i=0;i<num;i++){let a=bsplineBasis(i,p,Math.min(1,Math.max(0,t)),kn)*(weights?.[i]??1);w+=a;v=V.add(v,V.scale(controls[i],a))}return w>1e-10?V.scale(v,1/w):controls[num-1].slice()}
function nurbsCurve(controls,weights,degree=3,samples=80){if(!Array.isArray(controls)||controls.length<2||controls.length>64)throw Error('NURBS curve needs 2–64 control points');if(controls.some(p=>!Array.isArray(p)||p.length!==3||p.some(q=>!Number.isFinite(q))))throw Error('Control points must be finite XYZ triples');if(weights?.some(w=>!Number.isFinite(w)||w<=0))throw Error('Weights must be positive');let out=[];for(let i=0;i<=samples;i++)out.push(nurbsPoint(controls,weights,degree,i/samples));return out}
function nurbsSurfacePoint(controls,weights,degU,degV,u,v){let rows=controls.length,cols=controls[0].length,ku=knotVector(cols,degU),kv=knotVector(rows,degV),r=[0,0,0],sum=0;for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){let a=bsplineBasis(x,degU,u,ku)*bsplineBasis(y,degV,v,kv)*(weights?.[y]?.[x]??1);sum+=a;r=V.add(r,V.scale(controls[y][x],a))}return sum>1e-12?V.scale(r,1/sum):controls[rows-1][cols-1].slice()}
function meshNurbsSurface(cfg){let c=cfg.controls,ny=c.length,nx=c[0]?.length;if(nx<2||ny<2||nx>20||ny>20||c.some(row=>row.length!==nx))throw Error('NURBS surface requires a regular 2–20 by 2–20 control net');let du=Math.max(1,Math.min(nx-1,cfg.degreeU||3)),dv=Math.max(1,Math.min(ny-1,cfg.degreeV||3)),uCount=cfg.stepsU||40,vCount=cfg.stepsV||28;let m=newMesh();for(let j=0;j<=vCount;j++)for(let i=0;i<=uCount;i++){m.positions.push(...nurbsSurfacePoint(c,cfg.weights,du,dv,i/uCount,j/vCount));m.uvs.push(i/uCount,j/vCount)}for(let j=0;j<vCount;j++)for(let i=0;i<uCount;i++){let a=j*(uCount+1)+i,b=a+uCount+1;m.indices.push(a,a+1,b,b,a+1,b+1)}return smoothNormals(m)}
function curveFromSketch(){let s=getObj();if(s?.kind!=='sketch')return showToast('Select a sketch first');let controls=cleanPts(s.params.nurbs?.controls||s.params.points,s.params.closed);if(controls.length<2)return showToast('Not enough control points');let nu={controls:clone(controls),weights:controls.map(()=>1),degree:Math.min(3,controls.length-1),samples:72};let pts=nurbsCurve(nu.controls,nu.weights,nu.degree,nu.samples),o=makeSketch(pts,false,s.params.plane,s.name+' / NURBS');o.params.nurbs=nu;o.pos=[...s.pos];o.rot=[...s.rot];o.scale=[...s.scale];selectObject(o.id);commit('Created rational NURBS curve, editable control vertices')}
function defaultNurbsPatch(){let controls=[];for(let y=0;y<4;y++){let row=[];for(let x=0;x<4;x++)row.push([(x-1.5)*1.7,(y-1.5)*1.7,Math.sin(x*1.15)*Math.cos(y*1.1)*1.5+1.1]);controls.push(row)}let p={controls,weights:controls.map(r=>r.map(()=>1)),degreeU:3,degreeV:3,stepsU:32,stepsV:32};let o=newObj('NURBS · Curved patch','nurbs_surface',meshNurbsSurface(p),p,'aluminum');add(o);selectObject(o.id);commit('Created editable rational NURBS patch')}
function loftNurbs(){let a=project.objects.find(o=>o.id===ADV.operandA),b=project.objects.find(o=>o.id===ADV.operandB);if(a?.kind!=='sketch'||b?.kind!=='sketch')return showToast('Set A and B to two open sketches');let ca=cleanPts(a.params.nurbs?.controls||a.params.points,false),cb=cleanPts(b.params.nurbs?.controls||b.params.points,false);if(ca.length!==cb.length||ca.length<2||ca.length>20)return showToast('Profiles need 2–20 corresponding control points with equal counts');let c=[ca.map(p=>mp(matTRS(a),p)),cb.map(p=>mp(matTRS(b),p))],p={controls:c,weights:c.map(r=>r.map(()=>1)),degreeU:Math.min(3,ca.length-1),degreeV:1,stepsU:48,stepsV:20,loftSources:[a.id,b.id]};let o=newObj('NURBS · Lofted surface','nurbs_surface',meshNurbsSurface(p),p,'paint');add(o);selectObject(o.id);commit('Created editable NURBS loft from two profiles')}
function updateNurbs(o){if(o.kind==='nurbs_surface'){o.mesh=meshNurbsSurface(o.params);disposeGpu(o.id)}else if(o.kind==='sketch'&&o.params.nurbs){let p=o.params.nurbs;o.params.points=nurbsCurve(p.controls,p.weights,p.degree,p.samples);updateDependents(o)}else throw Error('Selected object is not a NURBS element');commit('Regenerated rational NURBS element')}
function nurbsInspector(o){if(!(o?.kind==='nurbs_surface'||o?.params?.nurbs))return;let p=o.kind==='nurbs_surface'?o.params:o.params.nurbs;
 const panel=$('geometryPanel');panel.innerHTML='<strong>Rational NURBS '+(o.kind==='nurbs_surface'?'surface':'curve')+'</strong><p class="hint">Control vertices and positive rational weights. Rebuilding updates geometry and UV coordinates. Values are true basis-evaluated B-splines.</p><div class="field"><label>Degree U</label><input type="number" id="nuDegree" min="1" max="7" value="'+(p.degreeU??p.degree)+'"></div>'+(o.kind==='nurbs_surface'?'<div class="field"><label>Degree V</label><input type="number" id="nvDegree" min="1" max="7" value="'+p.degreeV+'"></div>':'')+'<div class="sectionLabel">XYZ control net · JSON</div><textarea id="nuControls" style="width:100%;height:105px;font:11px monospace;resize:vertical">'+JSON.stringify(p.controls)+'</textarea><div class="sectionLabel">Rational weights · JSON</div><textarea id="nuWeights" style="width:100%;height:60px;font:11px monospace;resize:vertical">'+JSON.stringify(p.weights)+'</textarea><div class="row" style="margin-top:7px"><button class="action" id="nuApply">Apply NURBS edits</button></div>';
 $('nuApply').onclick=()=>{try{let controls=JSON.parse($('nuControls').value),weights=JSON.parse($('nuWeights').value);if(JSON.stringify(controls).length>30000)throw Error('Control net too large');p.controls=controls;p.weights=weights;if(o.kind==='nurbs_surface'){p.degreeU=Number($('nuDegree').value);p.degreeV=Number($('nvDegree').value)}else p.degree=Number($('nuDegree').value);updateNurbs(o)}catch(e){showToast(e.message)}};
}
