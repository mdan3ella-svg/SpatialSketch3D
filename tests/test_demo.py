import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
P=Path(__file__).resolve().parents[1]
async def main():
 async with async_playwright() as pl:
  b=await pl.chromium.launch(headless=True,executable_path=__import__('os').environ.get('CHROMIUM_BIN','/usr/bin/chromium'),args=['--no-sandbox','--disable-gpu'])
  p=await b.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
  errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  await p.set_content((P/'index.html').read_text())
  await p.get_by_text('◷ Animation',exact=True).click()
  await p.wait_for_timeout(150)
  output=await p.evaluate('''() => {const a=SPATIAL_ANIMATION_TEST.state();return {objects:project.objects.map(o=>o.name),tracks:Object.keys(a.tracks).length,cams:Object.keys(a.cameraTracks).length,keys:Object.values(a.tracks).reduce((n,t)=>n+t.length,0),duration:a.duration,closed:document.getElementById('launch').classList.contains('hidden')}}''')
  print(output);assert output['objects']==['Rotor Housing','Floating Core','Energy Ring'];assert output['tracks']==3 and output['cams']==1 and output['keys']>=10 and output['closed'];assert not errors
  await p.evaluate('SPATIAL_ANIMATION_TEST.seek(1.5)');await p.wait_for_timeout(130)
  await p.screenshot(path=str(P/'Spatial_Sketch_3D_v2_3_Animation_Demo_Preview.png'))
  model=await p.evaluate('serialize()');(P/'KINETIC_01_Animation_Demo.spatialsketch.json').write_text(json.dumps(json.loads(model),indent=2))
  print('demo saved bytes',len(model),'page errors',errors)
  await b.close()
asyncio.run(main())
