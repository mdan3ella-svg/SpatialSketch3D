/* Spatial Sketch 3D v2.2 — viewport/orbit and XYZ transform controls.
   Local, dependency-free enhancement to the existing editable modeling studio. */
(function installViewportControls(){
  'use strict';
  const host=document.getElementById('viewWrap');
  const nav=document.querySelector('.viewNav');
  if(!host || !nav) return;
  const EPS=1e-8;
  const AXES=[[1,0,0],[0,1,0],[0,0,1]];
  const COLORS=['#e95555','#22ad73','#438bea'];
  let mode='move', space='world', navigation='select';
  let gizmoPreview=[],pointerActive=null, gesture=null;
  const touchPoints=new Map();
  const oldCameraBasis=cameraBasis, oldLookAt=lookAt,oldHandleMotion=handleMotion,oldDrawOverlay=drawOverlay;
  const oldSetTool=setTool,oldCreatePrimitive=createPrimitive,oldCreateDerived=createDerived,oldFinishDraft=finishDraft,oldNewProject=newProject;
  function safeCameraBasis(c){
    const eye=cameraPosition(c),f=V.norm(V.sub(c.target,eye));
    let up=Math.abs(f[2])>.999? (f[2]<0?[0,1,0]:[0,-1,0]):[0,0,1];
    let r=V.cross(f,up),len=V.len(r);
    if(len<EPS){up=[0,1,0];r=V.cross(f,up);len=V.len(r)}
    r=V.scale(r,1/Math.max(EPS,len));
    const u=V.norm(V.cross(r,f));
    return{eye,f,r,u};
  }
  cameraBasis=safeCameraBasis;
  lookAt=function(eye,target){
    const f=V.norm(V.sub(target,eye));
    let up=Math.abs(f[2])>.999?(f[2]<0?[0,1,0]:[0,-1,0]):[0,0,1];
    let r=V.cross(f,up),size=V.len(r);
    if(size<EPS){r=V.cross(f,[0,1,0]);size=V.len(r)}
    r=V.scale(r,1/Math.max(size,EPS));const u=V.norm(V.cross(r,f));
    return [r[0],u[0],-f[0],0,r[1],u[1],-f[1],0,r[2],u[2],-f[2],0,-V.dot(r,eye),-V.dot(u,eye),V.dot(f,eye),1];
  };
  // Auto plane follows orthographic view but can be overridden explicitly.
  const planeSelect=document.getElementById('planeSelect');
  if(planeSelect&&!planeSelect.querySelector('[value="AUTO"]')){
    const opt=document.createElement('option');opt.value='AUTO';opt.textContent='Auto · Active View';
    planeSelect.insertBefore(opt,planeSelect.firstChild);planeSelect.value='AUTO';
  }
  const oldPlane=currentPlane;
  currentPlane=function(k=activePane){
    if(planeSelect?.value!=='AUTO')return oldPlane(k);
    const view=cams[k]?.kind;
    if(view==='front'||view==='rear')return{n:[0,-1,0],p:[0,0,0],label:'XZ'};
    if(view==='left'||view==='right')return{n:[1,0,0],p:[0,0,0],label:'YZ'};
    if(view==='top'||view==='bottom')return{n:[0,0,1],p:[0,0,0],label:'XY'};
    return {n:[0,0,1],p:[0,0,0],label:'XY'};
  };
  const oldSetView=setView;
  setView=function(v){
    oldSetView(v);
    const c=cams[activePane];
    c.kind=v;
    document.getElementById('viewSelect').value=v;
    refresh();
  };
  function syncPane(k){
    activePane=k;
    const select=document.getElementById('viewSelect');
    if(select && cams[k])select.value=cams[k].kind;
  }
  // Fix GPGPU YZ grid axis mapping: local XY -> world YZ, X = 0.
  // Correct mapping in existing drawFrame source is separately patched in build script.
  const controls=document.createElement('div');
  controls.id='spatialTransformDock';
  controls.className='spatialTransformDock';
  controls.setAttribute('aria-label','3D viewport navigation and transform gizmo');
  controls.innerHTML=`<div class="ssSegment" aria-label="Navigation modes">
    <button type="button" data-navmode="select" class="active" title="Select objects and use transform handles">⌖ Select</button>
    <button type="button" data-navmode="orbit" title="Left drag to orbit around the view target">◉ Orbit</button>
    <button type="button" data-navmode="pan" title="Left drag to pan in screen space">✥ Pan</button>
  </div><span class="ssDockSep"></span><div class="ssSegment" aria-label="Transform modes">
    <button type="button" data-gizmo="move" class="active" title="Move by dragging XYZ arrows · G">↔ Move</button>
    <button type="button" data-gizmo="rotate" title="Rotate by dragging colored axis rings · R">⟳ Rotate</button>
    <button type="button" data-gizmo="scale" title="Scale along axes or uniformly from center · S">◩ Scale</button>
  </div><button type="button" id="ssSpace" title="Toggle between world and local object axes">World</button>
  <span class="ssDockHelp" id="ssDockHelp">Right drag orbit · Middle drag pan · Scroll zoom</span>`;
  host.appendChild(controls);
  const compass=document.createElement('div');
  compass.className='ssCompass';compass.id='ssCompass';
  compass.setAttribute('aria-label','Clickable orientation compass');
  compass.innerHTML='<div class="ssCompassInner" id="ssCompassInner"></div><div class="ssCompassCaption">XYZ · Z UP</div>';
  host.appendChild(compass);
  const compassInner=compass.querySelector('#ssCompassInner');
  const compassButton=document.createElement('button');
  compassButton.type='button';compassButton.className='ssHome';compassButton.textContent='⌂';
  compassButton.title='Isometric viewpoint';
  compassButton.onclick=()=>setView('iso');compassInner.appendChild(compassButton);
  const dirs=[{a:[1,0,0],label:'X',view:'right',col:0},{a:[-1,0,0],label:'−X',view:'left',col:0},
    {a:[0,1,0],label:'Y',view:'rear',col:1},{a:[0,-1,0],label:'−Y',view:'front',col:1},
    {a:[0,0,1],label:'Z',view:'top',col:2},{a:[0,0,-1],label:'−Z',view:'bottom',col:2}];
  for(const dir of dirs){
    const btn=document.createElement('button');btn.type='button';btn.className='ssAxisDot';
    btn.textContent=dir.label;btn.title='Look from '+dir.label+' · '+dir.view;
    btn.setAttribute('aria-label','Set '+dir.view+' orthographic view');
    btn.dataset.view=dir.view;btn.style.setProperty('--axis-color',COLORS[dir.col]);
    btn.onclick=()=>{navigation='select';updateButtons();setView(dir.view)};
    dir.el=btn;compassInner.appendChild(btn);
  }
  function updateCompass(){
    const c=cams[activePane];if(!c)return;
    const b=cameraBasis(c);const size=compassInner.clientWidth||104,R=Math.max(20,size*.35),mid=size/2;
    let visible=[];
    for(const dir of dirs){
      const x=mid+V.dot(dir.a,b.r)*R,y=mid-V.dot(dir.a,b.u)*R,front=V.dot(dir.a,V.scale(b.f,-1));
      dir.el.style.left=x+'px';dir.el.style.top=y+'px';
      dir.el.style.zIndex=String(Math.round((front+1)*20)+3);
      dir.el.style.opacity=String(front<-.1?.44:1);
      dir.el.classList.toggle('active',c.kind===dir.view);
      visible.push(dir.el);
    }
    compassButton.style.left=mid+'px';compassButton.style.top=mid+'px';
  }
  function updateButtons(){
    controls.querySelectorAll('[data-gizmo]').forEach(b=>b.classList.toggle('active',b.dataset.gizmo===mode));
    controls.querySelectorAll('[data-navmode]').forEach(b=>b.classList.toggle('active',b.dataset.navmode===navigation));
    controls.querySelector('#ssSpace').textContent=space==='world'?'World':'Local';
  }
  controls.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.gizmo){mode=b.dataset.gizmo;navigation='select';oldSetTool('select')}
    else if(b.dataset.navmode){navigation=b.dataset.navmode;if(navigation!=='select')oldSetTool('select')}
    else if(b.id==='ssSpace'){space=space==='world'?'local':'world'}
    updateButtons();refresh();
  });
  const oldSetToolAgain=setTool;
  setTool=function(t){oldSetToolAgain(t);if(t!=='select')navigation='select';updateButtons();};
  createPrimitive=function(...args){oldCreatePrimitive(...args);oldSetTool('select');mode='move';navigation='select';updateButtons();refresh()};
  createDerived=function(...args){oldCreateDerived(...args);oldSetTool('select');mode='move';navigation='select';updateButtons();refresh()};
  finishDraft=function(...args){
    const previous=selected;
    oldFinishDraft(...args);
    if(selected&&selected!==previous&&getObj()?.kind==='sketch'){
      oldSetTool('select');mode='move';navigation='select';updateButtons();refresh();
    }
  };
  newProject=function(...args){
    oldNewProject(...args);
    activePane=0;
    // Starting a fresh document should not retain the previous project's camera undo snapshot.
    history=[serialize()];redo=[];
    updateButtons();refresh();
  };
  const oldMove=document.getElementById('moveToolBtn');
  if(oldMove){oldMove.textContent='XYZ Move gizmo';oldMove.title='Enable visible world/local move handles on selected objects';oldMove.onclick=()=>{mode='move';navigation='select';oldSetTool('select');updateButtons();refresh()}}
  function objectCenter(o){
    let center=[0,0,0];
    if(o.mesh?.positions?.length){const b=boundsMesh(o.mesh);center=b.center;}
    else if(o.kind==='sketch'&&o.params?.points?.length){center=o.params.points.reduce((acc,p)=>V.add(acc,p),[0,0,0]);center=V.scale(center,1/o.params.points.length)}
    return mp(matTRS(o),center);
  }
  function getAxis(o,i){
    if(space==='world')return AXES[i];
    const matrix=matTRS({...o,scale:[1,1,1]});
    return V.norm(mp(matrix,AXES[i],0));
  }
  function pixelSizeAt(c,center,k){
    const rect=paneRect(k),side=cameraBasis(c).r,unitPx=screenP(V.add(center,side),k),a=screenP(center,k);
    return a&&unitPx?Math.max(1,Math.hypot(unitPx[0]-a[0],unitPx[1]-a[1])):
      (c.kind==='perspective'?rect.h/(2*Math.max(.01,c.distance)*Math.tan(rad(c.fov)/2)):rect.h/(2*c.scale));
  }
  function computeGizmo(k){
    const o=getObj();if(!o?.visible)return null;
    const center=objectCenter(o),p=screenP(center,k),c=cams[k];if(!p)return null;
    const px=pixelSizeAt(c,center,k),len=Math.max(.03,Math.min(1000,68/px)),axes=[];
    for(let i=0;i<3;i++){
      const axis=getAxis(o,i),endWorld=V.add(center,V.scale(axis,len)),screen=screenP(endWorld,k);
      let end=screen||p,dx=end[0]-p[0],dy=end[1]-p[1];
      // An axis perpendicular to the screen is represented by an end-on target.
      const endOn=Math.hypot(dx,dy)<8;
      if(endOn){dx=(i===0?1:i===1?-1:0)*16;dy=i===2?-16:10;end=[p[0]+dx,p[1]+dy]}
      axes.push({axis,color:COLORS[i],label:'XYZ'[i],i,end,endOn,len,center,px});
    }
    return{object:o,center,p,px,len,axes,k};
  }
  function ringPoints(g,i){
    const axis=g.axes[i].axis,ref=Math.abs(axis[2])>.82?[1,0,0]:[0,0,1];
    const u=V.norm(V.cross(axis,ref)),v=V.norm(V.cross(axis,u));
    let points=[];for(let j=0;j<=88;j++){
      const t=j*Math.PI*2/88;const world=V.add(g.center,V.scale(V.add(V.scale(u,Math.cos(t)),V.scale(v,Math.sin(t))),g.len*.83));
      points.push(screenP(world,g.k));
    }
    return points;
  }
  function drawGizmoOverlay(){
    if(typeof renderSizeOverride!=='undefined'&&renderSizeOverride)return;
    if(!getObj()||tool!=='select'&&tool!=='editpoint')return;
    const count=quadMode?4:1;gizmoPreview=[];
    g2.save();g2.font='700 11px Segoe UI, Arial';g2.lineCap='round';g2.lineJoin='round';
    for(let k=0;k<count;k++){
      const g=computeGizmo(k);if(!g)continue;gizmoPreview.push(g);
      const rect=paneRect(k);
      g2.save();g2.beginPath();g2.rect(rect.x,rect.y,rect.w,rect.h);g2.clip();
      if(mode==='rotate'){
        for(const a of g.axes){const pts=ringPoints(g,a.i);g2.strokeStyle=a.color;g2.lineWidth=k===activePane?3.2:2.1;
          g2.beginPath();pts.forEach((p,i)=>{if(!p)return;if(i===0||!pts[i-1])g2.moveTo(...p);else g2.lineTo(...p)});g2.stroke();
          const visible=pts.filter(Boolean);if(visible.length){const labelPoint=visible[Math.floor(visible.length*(a.i*.27+.09))];g2.fillStyle=a.color;g2.fillText(a.label,labelPoint[0]+5,labelPoint[1]-5)}
        }
      }else{
        for(const a of g.axes){
          g2.strokeStyle=a.color;g2.fillStyle=a.color;g2.lineWidth=3.6;g2.beginPath();g2.moveTo(...g.p);g2.lineTo(...a.end);g2.stroke();
          if(mode==='move'&&!a.endOn){let dx=a.end[0]-g.p[0],dy=a.end[1]-g.p[1],L=Math.hypot(dx,dy)||1;dx/=L;dy/=L;g2.beginPath();g2.moveTo(a.end[0]+dx*4,a.end[1]+dy*4);g2.lineTo(a.end[0]-dx*9-dy*5,a.end[1]-dy*9+dx*5);g2.lineTo(a.end[0]-dx*9+dy*5,a.end[1]-dy*9-dx*5);g2.closePath();g2.fill()}
          else{g2.fillRect(a.end[0]-5,a.end[1]-5,10,10)}
          g2.fillStyle='#102d33';g2.fillText(a.label,a.end[0]+7,a.end[1]-7);
        }
        if(mode==='scale'){g2.fillStyle='#ffffff';g2.strokeStyle='#102d33';g2.lineWidth=2;g2.fillRect(g.p[0]-7,g.p[1]-7,14,14);g2.strokeRect(g.p[0]-7,g.p[1]-7,14,14)}
      }
      g2.fillStyle='#ffffff';g2.strokeStyle='#254853';g2.lineWidth=1.8;g2.beginPath();g2.arc(g.p[0],g.p[1],mode==='rotate'?4:3.2,0,Math.PI*2);g2.fill();g2.stroke();
      g2.restore();
    }
    g2.restore();
  }
  drawOverlay=function(){oldDrawOverlay();drawGizmoOverlay();updateCompass()};
  function segmentDistance(px,py,a,b){const d=[b[0]-a[0],b[1]-a[1]],s=d[0]*d[0]+d[1]*d[1];const t=Math.max(0,Math.min(1,s>0?((px-a[0])*d[0]+(py-a[1])*d[1])/s:0));return Math.hypot(px-(a[0]+t*d[0]),py-(a[1]+t*d[1]))}
  function nearestHandle(x,y,k){
    if(!getObj()||tool!=='select')return null;
    const g=computeGizmo(k);if(!g)return null;
    const hits=[];
    if(mode==='scale'&&Math.hypot(x-g.p[0],y-g.p[1])<12)hits.push({axis:-1,dist:0,g});
    for(const a of g.axes){
      if(mode==='rotate'){
        const pts=ringPoints(g,a.i);for(let j=1;j<pts.length;j++)if(pts[j]&&pts[j-1]){
          const d=segmentDistance(x,y,pts[j-1],pts[j]);if(d<11)hits.push({axis:a.i,dist:d,g});
        }
      }else{
        const dEnd=Math.hypot(x-a.end[0],y-a.end[1]);
        const dSeg=segmentDistance(x,y,g.p,a.end);
        const d=Math.min(dEnd,dSeg+(Math.hypot(x-g.p[0],y-g.p[1])<12?20:0));
        if(d<12)hits.push({axis:a.i,dist:d,g});
      }
    }
    hits.sort((a,b)=>a.dist-b.dist);
    return hits[0]||null;
  }
  function quatEuler(e){
    const [x,y,z]=e.map(v=>rad(v)/2),[sx,cx,sy,cy,sz,cz]=[Math.sin(x),Math.cos(x),Math.sin(y),Math.cos(y),Math.sin(z),Math.cos(z)];
    return[sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz];
  }
  function quatMul(a,b){return[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]]}
  function eulerQuat(q){
    const[x,y,z,w]=q;
    return [deg(Math.atan2(2*(w*x+y*z),1-2*(x*x+y*y))),deg(Math.asin(Math.max(-1,Math.min(1,2*(w*y-z*x))))),deg(Math.atan2(2*(w*z+x*y),1-2*(y*y+z*z)))];
  }
  function startGizmo(hit,x,y,k,e){
    const g=hit.g,o=g.object,axis=hit.axis,screen=g.p;
    const a=axis>=0?g.axes[axis]:null;
    pointerActive={id:e.pointerId,objectId:o.id,axis,mode,space,k,center:g.center,
      start:clone({pos:o.pos,rot:o.rot,scale:o.scale}),x,y,px:g.px,
      axisWorld:a?.axis||null,eyeDirection:V.scale(cameraBasis(cams[k]).f,-1),
      projected:a?[a.end[0]-screen[0],a.end[1]-screen[1]]:null,
      origin:[...screen],changed:false};
    drag={type:'spatialGizmo',k};
    canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';
    e.preventDefault();e.stopImmediatePropagation();
  }
  function refreshTransformFields(o){
    document.querySelectorAll('[data-vec]').forEach(f=>{
      const a=Number(f.dataset.axis),value=o[f.dataset.vec]?.[a];if(Number.isFinite(value)&&document.activeElement!==f)f.value=Number(value.toFixed(5));
    });
  }
  function applyGizmo(x,y,e){
    const s=pointerActive;if(!s)return;
    const o=project.objects.find(t=>t.id===s.objectId);if(!o)return;
    const dx=x-s.x,dy=y-s.y;
    if(s.mode==='move'){
      const p=s.projected,L=Math.hypot(...p),screenDirection=L>7?[p[0]/L,p[1]/L]:[0,-1];
      const pixPerUnit=L>7?L/Math.max(.001,68/s.px):s.px;
      let delta=(dx*screenDirection[0]+dy*screenDirection[1])/Math.max(.001,pixPerUnit);
      if(e.shiftKey){const step=Math.max(.01,Number(document.getElementById('gridSnap').value)||.5);delta=Math.round(delta/step)*step}
      o.pos=V.add(s.start.pos,V.scale(s.axisWorld,delta));
    }else if(s.mode==='scale'){
      if(s.axis===-1){let factor=Math.exp(-dy/110);for(let i=0;i<3;i++)o.scale[i]=Math.sign(s.start.scale[i]||1)*Math.max(.001,Math.min(10000,Math.abs(s.start.scale[i])*factor))}
      else{const p=s.projected,L=Math.hypot(...p),direction=L>7?[p[0]/L,p[1]/L]:[0,-1];
        const shift=(dx*direction[0]+dy*direction[1])/90, factor=Math.exp(shift);
        o.scale=[...s.start.scale];o.scale[s.axis]=Math.sign(s.start.scale[s.axis]||1)*Math.max(.001,Math.min(10000,Math.abs(s.start.scale[s.axis])*factor))}
    }else if(s.mode==='rotate'){
      const a0=Math.atan2(s.y-s.origin[1],s.x-s.origin[0]);
      const a1=Math.atan2(y-s.origin[1],x-s.origin[0]);
      let angle=a1-a0;if(angle>Math.PI)angle-=2*Math.PI;if(angle<-Math.PI)angle+=2*Math.PI;
      if(V.dot(s.axisWorld,s.eyeDirection)<0)angle=-angle;
      if(e.shiftKey)angle=rad(Math.round(deg(angle)/15)*15);
      const q0=quatEuler(s.start.rot),sin=Math.sin(angle/2);
      const qd=[s.axisWorld[0]*sin,s.axisWorld[1]*sin,s.axisWorld[2]*sin,Math.cos(angle/2)];
      const q=quatMul(qd,q0);
      o.rot=eulerQuat(q);
    }
    if(o.kind==='sketch')for(const ch of project.objects)if(ch.source===o.id){ch.pos=[...o.pos];ch.rot=[...o.rot];ch.scale=[...o.scale]}
    s.changed=dx*dx+dy*dy>1;
    refreshTransformFields(o);refresh();
  }
  function finishGizmo(e){
    const s=pointerActive;if(!s)return false;
    if(e.pointerId!==s.id)return false;
    pointerActive=null;drag=null;canvas.style.cursor='';
    if(s.changed){commit(({move:'Moved',rotate:'Rotated',scale:'Scaled'})[s.mode]+' object with '+(s.axis<0?'uniform':'XYZ'[s.axis])+' '+s.space+' gizmo')}
    else refresh();
    return true;
  }
  const oldMotion=handleMotion;
  handleMotion=function(x,y,e){
    if(drag?.type==='spatialGizmo')return;
    if(drag?.type==='orbit'){
      const k=drag.k,c=cams[k],rect=paneRect(k),s=drag.c;
      c.yaw=s.yaw+(x-drag.x)*Math.PI*2/Math.max(120,rect.w);
      c.pitch=Math.max(-Math.PI/2+.001,Math.min(Math.PI/2-.001,s.pitch+(y-drag.y)*Math.PI/Math.max(120,rect.h)));
      if(c.kind!=='perspective'&&c.kind!=='iso')c.kind='perspective';
      if(activePane===k)document.getElementById('viewSelect').value=c.kind;
      refresh();return;
    }
    if(drag?.type==='pan'){
      const k=drag.k,c=cams[k],r=paneRect(k),b=cameraBasis(drag.c),factor=c.kind==='perspective'?
        2*drag.c.distance*Math.tan(rad(drag.c.fov)/2)/Math.max(1,r.h):2*drag.c.scale/Math.max(1,r.h);
      c.target=V.add(drag.c.target,V.add(V.scale(b.r,-(x-drag.x)*factor),V.scale(b.u,(y-drag.y)*factor)));
      refresh();return;
    }
    return oldMotion(x,y,e);
  };
  // Capture phase to route actual handle drag ahead of sketch-selection logic.
  canvas.addEventListener('pointerdown',e=>{
    const [x,y]=pointerCoords(e),k=paneAt(x,y);syncPane(k);
    if(e.pointerType==='touch'){
      touchPoints.set(e.pointerId,{x,y});
      if(touchPoints.size===2){
        const p=[...touchPoints.values()];gesture={k,center:[(p[0].x+p[1].x)/2,(p[0].y+p[1].y)/2],distance:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),camera:clone(cams[k])};
        drag={type:'spatialTouch',k};e.preventDefault();e.stopImmediatePropagation();return;
      }
    }
    if(e.button!==0)return;
    if(navigation!=='select'){
      drag={type:navigation,x,y,k,c:clone(cams[k])};
      canvas.setPointerCapture(e.pointerId);e.preventDefault();e.stopImmediatePropagation();return;
    }
    if(tool==='select'){
      const hit=nearestHandle(x,y,k);
      if(hit){startGizmo(hit,x,y,k,e);return}
    }
  },true);
  canvas.addEventListener('pointermove',e=>{
    const [x,y]=pointerCoords(e);
    if(touchPoints.has(e.pointerId))touchPoints.set(e.pointerId,{x,y});
    if(gesture&&touchPoints.size>=2){
      const p=[...touchPoints.values()],k=gesture.k;
      const center=[(p[0].x+p[1].x)/2,(p[0].y+p[1].y)/2],distance=Math.max(15,Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y));
      const c=cams[k],initial=gesture.camera,b=cameraBasis(initial),r=paneRect(k),factor=initial.kind==='perspective'?2*initial.distance*Math.tan(rad(initial.fov)/2)/r.h:2*initial.scale/r.h;
      c.target=V.add(initial.target,V.add(V.scale(b.r,-(center[0]-gesture.center[0])*factor),V.scale(b.u,(center[1]-gesture.center[1])*factor)));
      if(c.kind==='perspective'){c.distance=Math.max(.15,Math.min(5000,initial.distance*gesture.distance/distance))}
      else c.scale=Math.max(.025,Math.min(2500,initial.scale*gesture.distance/distance));
      refresh();e.preventDefault();e.stopImmediatePropagation();return;
    }
    if(pointerActive&&e.pointerId===pointerActive.id){applyGizmo(x,y,e);e.preventDefault();e.stopImmediatePropagation();return}
    if(!drag&&tool==='select'&&navigation==='select'){
      const hit=nearestHandle(x,y,paneAt(x,y));canvas.style.cursor=hit?'grab':'';
    }
  },true);
  function endPointer(e){touchPoints.delete(e.pointerId);if(touchPoints.size<2){gesture=null;if(drag?.type==='spatialTouch')drag=null}
    if(finishGizmo(e)){e.preventDefault();e.stopImmediatePropagation()}
  }
  canvas.addEventListener('pointerup',endPointer,true);
  canvas.addEventListener('pointercancel',endPointer,true);
  // Retain world point under cursor while dollying/ortho-zooming.
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();e.stopImmediatePropagation();
    const [x,y]=pointerCoords(e),k=paneAt(x,y),c=cams[k];syncPane(k);
    const b=cameraBasis(c),plane={p:[...c.target],n:b.f};
    const before=rayPlane(viewRay(x,y,k),plane.n,plane.p);
    const delta=Math.max(-700,Math.min(700,e.deltaY))*Math.min(2,Math.max(.001,e.deltaMode===1?16:e.deltaMode===2?300:1));
    const amount=Math.exp(delta*.001);
    if(c.kind==='perspective')c.distance=Math.max(.1,Math.min(5000,c.distance*amount));
    else c.scale=Math.max(.025,Math.min(2500,c.scale*amount));
    if(before){const after=rayPlane(viewRay(x,y,k),plane.n,plane.p);if(after)c.target=V.add(c.target,V.sub(before,after))}
    refresh();
  },{capture:true,passive:false});
  // Common industry shortcuts: G move, R rotate, S scale. Do not capture focused text inputs.
  window.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
    const key=e.key.toLowerCase();
    if(key==='escape'&&pointerActive){const o=project.objects.find(t=>t.id===pointerActive.objectId);if(o){o.pos=[...pointerActive.start.pos];o.rot=[...pointerActive.start.rot];o.scale=[...pointerActive.start.scale];refreshTransformFields(o)}pointerActive=null;drag=null;canvas.style.cursor='';refresh();e.preventDefault();e.stopImmediatePropagation();return}
    if(['g','r','s'].includes(key)){
      e.preventDefault();mode={g:'move',r:'rotate',s:'scale'}[key];navigation='select';oldSetTool('select');updateButtons();refresh();
    }
  },true);
  const resizeDock=()=>{
    const rootRect=host.getBoundingClientRect(),r=nav.getBoundingClientRect();
    const top=Math.max(8,r.bottom-rootRect.top+7);
    controls.style.top=top+'px';
    const y=top+controls.getBoundingClientRect().height+11;
    const bottom=Math.max(y,host.clientHeight-compass.getBoundingClientRect().height-12);
    compass.style.top=(window.innerWidth<=740?bottom:y)+'px';
  };
  new ResizeObserver(resizeDock).observe(nav);
  new ResizeObserver(resizeDock).observe(controls);
  new ResizeObserver(resizeDock).observe(host);
  window.addEventListener('resize',resizeDock);
  updateButtons();setTimeout(()=>{resizeDock();refresh()},30);
  window.SPATIAL_CONTROLS_TEST={getMode:()=>mode,setMode:(m)=>{mode=m;updateButtons();refresh()},getNavigation:()=>navigation,
    getCompass:()=>dirs.map(d=>({axis:d.label,view:d.view})),getCameraBasis:c=>safeCameraBasis(c||cams[activePane]),
    getGizmo:k=>computeGizmo(k??activePane),getRingPoints:(i,k=activePane)=>{const g=computeGizmo(k);return g?ringPoints(g,i):[]},getCamera:k=>cams[k??activePane],getDrag:()=>drag,
    setSpace:s=>{space=s;updateButtons();refresh()},hitHandle:(x,y,k=activePane)=>nearestHandle(x,y,k),
    orbit:(dyaw,dpitch,k=activePane)=>{cams[k].yaw+=dyaw;cams[k].pitch=Math.max(-Math.PI/2+.001,Math.min(Math.PI/2-.001,cams[k].pitch+dpitch));refresh()}};
})();
