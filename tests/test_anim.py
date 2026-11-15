import json,asyncio,struct,math,sys,threading,http.server,functools
from pathlib import Path
from playwright.async_api import async_playwright
BASE=Path(__file__).resolve().parents[1];HTML=BASE/'index.html'
async def run():
 server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(http.server.SimpleHTTPRequestHandler,directory='/mnt/data'))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path=__import__('os').environ.get('CHROMIUM_BIN','/usr/bin/chromium'),args=['--no-sandbox','--disable-gpu','--disable-web-security','--use-gl=swiftshader'])
  page=await browser.new_page(viewport={'width':1366,'height':850},accept_downloads=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content(HTML.read_text(),wait_until='domcontentloaded')
  await page.wait_for_function('Boolean(window.SPATIAL_ANIMATION_TEST)')
  await page.locator('#launchNew').click()
  await page.evaluate("window.FORMCRAFT_TEST.createPrimitive('box')")
  await page.locator('#timelineToggle').click()
  await page.screenshot(path=str(BASE/'test_animation_ui.png'))
  snapshot=await page.evaluate('''() => {const a=SPATIAL_ANIMATION_TEST;
   a.setDuration(4);a.setSnap(false);a.setEase('linear');const o=FORMCRAFT_TEST.getProject().objects[0];
   o.pos=[0,0,1];o.rot=[0,0,0];o.scale=[1,1,1];o.mat.color='#000000';o.mat.emit=0;
   a.seek(0);a.recordObject(o);
   a.seek(4);o.pos=[8,4,3];o.rot=[0,0,180];o.scale=[2,2,2];o.mat.color='#ffffff';o.mat.emit=2;
   a.recordObject(o);
   a.seek(2);return {id:o.id,pos:o.pos,rot:o.rot,scale:o.scale,color:o.mat.color,emit:o.mat.emit,keys:a.state().tracks[o.id].length,source:o}
  }''')
  print('midpoint',json.dumps({k:v for k,v in snapshot.items() if k!='source'}));assert abs(snapshot['pos'][0]-4)<.03;assert abs(snapshot['rot'][2]-90)<1;assert snapshot['color']=='#808080';assert snapshot['keys']==2
  saved=await page.evaluate('''() => {const d=JSON.parse(serialize());const o=d.objects.find(o=>o.id===FORMCRAFT_TEST.getSelected());return{pos:o?.pos,cams:d.views?.length,duration:d.animations.duration,keys:d.animations.tracks[FORMCRAFT_TEST.getSelected()].length}}''')
  print('saved authored rest',saved);assert saved['pos'][0]==0
  # Real glTF animation output is generated, not merely described.
  async with page.expect_download() as download_info:await page.evaluate('exportGLB()')
  download=await download_info.value;out=BASE/'test_animation.glb';await download.save_as(str(out))
  b=out.read_bytes();jsz,typ=struct.unpack_from('<II',b,12);glb=json.loads(b[20:20+jsz]);clips=glb.get('animations',[])
  print('GLB channels',len(clips[0]['channels']) if clips else 0,'samplers',len(clips[0]['samplers']) if clips else 0,'bytes',len(b))
  assert len(clips)==1 and len(clips[0]['channels'])==3
  for s in clips[0]['samplers']:
   ai=glb['accessors'][s['input']];vi=glb['accessors'][s['output']];assert ai['count']==vi['count'];assert ai['count']>=3
  # Camera animation on 2nd viewport no longer updates first only.
  camera=await page.evaluate('''() => {const a=SPATIAL_ANIMATION_TEST;a.setDuration(4);a.seek(0);const before=cams[0].yaw;cams[1].yaw=.1;a.recordCamera(1);a.seek(4);cams[1].yaw=1.1;a.recordCamera(1);a.seek(2);return {second:cams[1].yaw,first:cams[0].yaw,before,tracks:Object.keys(a.state().cameraTracks)}}''')
  print('camera',camera);assert abs(camera['second']-.6)<.03;assert abs(camera['first']-camera['before'])<1e-5
  # smoother interpolation, step behavior, and alpha/visibility.
  interp=await page.evaluate('''() => {const a=SPATIAL_ANIMATION_TEST;const o=FORMCRAFT_TEST.getProject().objects[0];a.setEase('step');const id=o.id;for(let k of a.state().tracks[id])k.ease='step';a.seek(2);const step=o.pos[0];for(let k of a.state().tracks[id])k.ease='smooth';a.setEase('smooth');a.seek(1);const smooth=o.pos[0];a.seek(3);return{step,smooth,late:o.pos[0]}}''')
  print('interp',interp);assert interp['step']==0 and interp['smooth']<2 and interp['late']>6
  # Native project persistence roundtrip.
  data=await page.evaluate('serialize()');await page.evaluate('(text)=>loadProject(JSON.parse(text))',data)
  roundtrip=await page.evaluate('''() => {const a=SPATIAL_ANIMATION_TEST;let o=FORMCRAFT_TEST.getProject().objects[0];a.seek(4);return{pos:o.pos,tracks:Object.keys(a.state().tracks),duration:a.state().duration,cameras:Object.keys(a.state().cameraTracks)}}''')
  print('roundtrip',roundtrip);assert roundtrip['pos'][0]==8 and len(roundtrip['tracks'])==1 and '1' in roundtrip['cameras']
  # timeline UI data controls; track row materialization
  if await page.locator('#timelineDock').evaluate('(e)=>e.classList.contains("hidden")'): await page.locator('#timelineToggle').click()
  stats=await page.evaluate('''() => ({rows:document.querySelectorAll('.animTrackRow').length, options:document.getElementById('animTrackSelect').options.length, heights:document.getElementById('timelineDock').getBoundingClientRect().height})''')
  print('UI',stats);assert stats['rows']>=2 and stats['options']>=5
  # play and pause does advance
  play=await page.evaluate('''() => {const a=SPATIAL_ANIMATION_TEST;a.seek(0);a.play();return a.getTime()}''');await page.wait_for_timeout(290)
  elapsed=await page.evaluate('''() => {const a=SPATIAL_ANIMATION_TEST;a.pause();return a.getTime()}''');print('playtime',elapsed);assert elapsed>.06
  await page.screenshot(path=str(BASE/'test_animation_scene.png'))
  # portrait viewport avoids cropped timeline controls.
  await page.set_viewport_size({'width':390,'height':844});await page.wait_for_timeout(250)
  await page.screenshot(path=str(BASE/'test_animation_mobile.png'))
  bounds=await page.evaluate('''() => {const a=document.getElementById('timelineDock').getBoundingClientRect();const b=document.getElementById('animExtra').getBoundingClientRect();return{dockWidth:a.width,extraWidth:b.width,window:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}}''')
  print('mobile',bounds);assert not bounds['overflow'] and bounds['dockWidth']<=390
  print('pageerrors',errors);assert not errors
  await browser.close()
if __name__=='__main__':asyncio.run(run())
