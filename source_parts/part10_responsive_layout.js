
/* Spatial Sketch 3D v2.1.1 — adaptive shell and pane resizing.
   Does not modify modeling, camera directions or export mathematics. */
(function installResponsiveShell(){
  const main=document.getElementById('viewWrap'), stage=main?.parentElement;
  if(!main||!stage)return;
  const column=document.createElement('div');
  column.className='viewportShell';
  stage.insertBefore(column,main);
  column.appendChild(main);
  const dock=document.getElementById('timelineDock');
  if(dock)column.appendChild(dock); // timeline uses its own vertical space; no canvas occlusion
  const body=document.body, tools=document.getElementById('toolsBtn'), inspector=document.getElementById('inspectorBtn');
  const scrim=document.getElementById('panelScrim');
  const narrow=()=>window.matchMedia('(max-width: 740px)').matches;
  const drawerInspector=()=>window.matchMedia('(max-width: 1050px)').matches;
  const syncAria=()=>{
    tools?.setAttribute('aria-expanded',String(body.classList.contains('toolsOpen')));
    inspector?.setAttribute('aria-expanded',String(!body.classList.contains('hideInspector')));
    tools?.setAttribute('aria-controls','toolSidebar');
    inspector?.setAttribute('aria-controls','inspector');
  };
  let wasDrawer=drawerInspector();
  if(wasDrawer)body.classList.add('hideInspector');
  const closePanels=()=>{body.classList.remove('toolsOpen');body.classList.add('hideInspector');syncAria()};
  tools?.addEventListener('click',()=>{
    let shouldOpen=!body.classList.contains('toolsOpen');
    body.classList.add('hideInspector');
    body.classList.toggle('toolsOpen',shouldOpen);
    syncAria();
    requestAnimationFrame(()=>{resizeCanvas(true);refresh()});
  });
  // Existing inspector handler remains intact. This post-handler enforces one drawer at a time.
  inspector?.addEventListener('click',()=>{
    body.classList.remove('toolsOpen');syncAria();
    requestAnimationFrame(()=>{resizeCanvas(true);refresh()});
  });
  scrim?.addEventListener('click',closePanels);
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&(body.classList.contains('toolsOpen')|| (drawerInspector()&&!body.classList.contains('hideInspector'))))closePanels()});
  function setShellMeasurements(){
    const header=document.querySelector('.top'),footer=document.querySelector('.status');
    body.style.setProperty('--header-bottom',Math.ceil(header.getBoundingClientRect().bottom)+'px');
    body.style.setProperty('--footer-height',Math.ceil(footer.getBoundingClientRect().height)+'px');
  }
  function adapt(){
    const currentlyDrawer=drawerInspector();
    if(currentlyDrawer&&!wasDrawer)body.classList.add('hideInspector');
    if(!narrow())body.classList.remove('toolsOpen');
    wasDrawer=currentlyDrawer;
    setShellMeasurements();syncAria();
  }
  let queued=false;
  function relayout(){
    if(queued)return; queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      setShellMeasurements();
      resizeCanvas(true);
      refresh();
    });
  }
  const resizeObserver=new ResizeObserver(relayout);
  resizeObserver.observe(main);
  resizeObserver.observe(document.querySelector('.top'));
  resizeObserver.observe(document.querySelector('.status'));
  resizeObserver.observe(column);
  window.addEventListener('resize',()=>{adapt();relayout()});
  const toolButtons=document.querySelectorAll('#toolSidebar button:not(#toolsBtn)');
  toolButtons.forEach(b=>b.addEventListener('click',()=>{
    if(narrow() && (b.matches('[data-tool],[data-shape],[data-demo]') || b.id==='finishClose' || b.id==='finishOpen')){
      body.classList.remove('toolsOpen');syncAria();
    }
  }));
  adapt();
  setTimeout(relayout,0);
})();
