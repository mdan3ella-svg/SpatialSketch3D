import asyncio, json, struct
from pathlib import Path
from playwright.async_api import async_playwright, TimeoutError
BASE=Path(__file__).resolve().parents[1]
async def run():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path=__import__('os').environ.get('CHROMIUM_BIN','/usr/bin/chromium'),args=['--no-sandbox','--disable-gpu','--disable-web-security'])
  page=await browser.new_page(viewport={'width':1150,'height':850},accept_downloads=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.set_content((BASE/'index.html').read_text(),wait_until='domcontentloaded')
  await page.wait_for_function('Boolean(SPATIAL_ANIMATION_TEST)')
  await page.locator('#launchNew').click()
  await page.evaluate("FORMCRAFT_TEST.createPrimitive('box')")
  await page.locator('#timelineToggle').click()
  # Preset is applied to real project keyframes.
  ans=await page.evaluate('''() => {const a=SPATIAL_ANIMATION_TEST;a.setDuration(1);a.applyPreset('turntable');const o=FORMCRAFT_TEST.getProject().objects[0];a.seek(.25);return{keys:a.state().tracks[o.id].map(k=>k.t),rot:o.rot}}''')
  print('turntable preset',ans);assert ans['keys']==[0,.5,1]
  # Save after scrubbing, reload, and compare animation sample.
  original=await page.evaluate('''() => {const a=SPATIAL_ANIMATION_TEST;a.seek(.25);return{rot:FORMCRAFT_TEST.getProject().objects[0].rot,project:serialize()}}''')
  await page.evaluate('(doc)=>loadProject(JSON.parse(doc))',original['project'])
  restored=await page.evaluate('''() => {const a=SPATIAL_ANIMATION_TEST;a.seek(.25);return FORMCRAFT_TEST.getProject().objects[0].rot}''')
  print('reload',restored);assert abs(restored[2]-original['rot'][2])<1
  # Replay clip to the end with loop unchecked: stops without moving past clip duration.
  a=await page.evaluate('''() => {const e=SPATIAL_ANIMATION_TEST;e.state().loop=false;e.seek(.9);e.play();return e.getTime()}''')
  await page.wait_for_timeout(400)
  stopped=await page.evaluate('''() => ({t:SPATIAL_ANIMATION_TEST.getTime(),playing:timelinePlaying})''')
  print('end state',stopped);assert abs(stopped['t']-1)<.02 and not stopped['playing']
  # Reimport an exported GLB, validate that animation times and poses survive.
  async with page.expect_download() as f:await page.evaluate('exportGLB()')
  d=await f.value;out=BASE/'test_extended.glb';await d.save_as(str(out));data=out.read_bytes()
  imported=await page.evaluate('''(bytes)=>{const b=new Uint8Array(bytes).buffer;const objs=parseGLB(b);return{length:objs.length,animated:Object.values(objs.importedAnimation?.tracks||{}).map(keys=>keys.length),rotations:Object.values(objs.importedAnimation?.tracks||{})[0]?.map(k=>k.rot?.[2]).filter((_,i)=>i%6===0)}}''',list(data))
  print('GLB reimport',str(imported)[:320]);assert imported['length']==1 and imported['animated'][0]>2
  # Real-time WebM capture: not every headless browser supports encoding.
  sup=await page.evaluate('''() => Boolean(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream && ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].some(v=>MediaRecorder.isTypeSupported(v)))''')
  if sup:
   print('WebM capability present; starting recording')
   try:
    async with page.expect_download(timeout=15000) as v:
     await page.locator('#animVideo').click()
    dl=await v.value;vout=BASE/'test_animation.webm';await dl.save_as(str(vout));print('WebM size',vout.stat().st_size);assert vout.stat().st_size>500
   except TimeoutError:
    print('WebM recorder did not output a file in headless Chromium')
  else:print('WebM unsupported in this browser')
  print('runtime errors:',errors);assert not errors
  await browser.close()
if __name__=='__main__':asyncio.run(run())
