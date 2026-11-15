"""Reproducible smoke and integration tests for Spatial Sketch 3D 2.4.
Run: python tests/test_motion_v24.py. Playwright Chromium and Python required.
No remote scripts or CDN dependencies are loaded.
"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'Spatial_Sketch_3D_v2_4_Advanced_Motion.html').read_text()
report={}
def record(name,result):
    print(f'{name}:',result)
    report[name]=result

def run():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu'])
        page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
        errors=[];page.on('pageerror',lambda ex:errors.append(str(ex)))
        page.set_content(HTML)
        assert page.locator('#motion24').count()==1
        record('startup',{'loaded':True,'motionAPI':page.evaluate('!!window.SPATIAL_MOTION_TEST'),'exportAPI':page.evaluate('!!window.SPATIAL_MOTION_EXPORT_TEST')})
        result=page.evaluate('''()=>{
          createPrimitive('box');let o=getObj(),api=window.SPATIAL_MOTION_TEST,r=api.rigObject('chain','smooth'),rest=o.mesh.positions.slice();
          r.rig.bones[1].rot=[20,0,0];api.deformRig(r);let shift=rest.reduce((sum,v,j)=>sum+Math.abs(v-r.mesh.positions[j]),0);
          return {vertices:rest.length/3,bones:r.rig.bones.length,weights:r.rig.weights.length,shift,finite:r.mesh.positions.every(Number.isFinite)}
        }''')
        assert result['bones']==3 and result['weights']==result['vertices'] and result['shift']>0 and result['finite'];record('smoothSkinning',result)
        result=page.evaluate('''()=>{let o=getObj(),a=window.SPATIAL_MOTION_TEST,b=o.rig.bones,t=[.35,.2,.40];a.solveIK(o,2,t,3);let q=a.boneTransforms(o).at(-1),v=b.at(-1).tail.map((x,j)=>x-b.at(-1).head[j]),r=q.quat,d=[2*(r[1]*v[2]-r[2]*v[1]),2*(r[2]*v[0]-r[0]*v[2]),2*(r[0]*v[1]-r[1]*v[0])],c=[r[1]*d[2]-r[2]*d[1],r[2]*d[0]-r[0]*d[2],r[0]*d[1]-r[1]*d[0]],end=v.map((x,i)=>x+r[3]*d[i]+c[i]+q.head[i]);return{error:Math.hypot(...end.map((x,i)=>x-t[i])),target:t,actual:end}}''')
        assert result['error']<.002;record('IKReachableChain',result)
        result=page.evaluate('''()=>{let api=window.SPATIAL_MOTION_TEST,o=getObj();api.rigObject('chain','rigid');return{vertices:o.rig.weights.length,allRigid:o.rig.weights.every(w=>w.w[0]===1&&w.w.slice(1).every(n=>n===0))}}''')
        assert result['allRigid'];record('hardSurfaceWeights',result)
        result=page.evaluate('''()=>{let o=getObj(),api=window.SPATIAL_MOTION_TEST,a=api.getMotion();a.duration=2;a.ikTracks[o.id]={2:{chain:3,keys:[{t:0,pos:[.2,.1,.8]},{t:1,pos:[.3,.3,.4]},{t:2,pos:[-.1,.1,.6]}]}};api.seek(0);let before=o.mesh.positions.slice();api.seek(1);let after=o.mesh.positions.slice();return {keyframes:a.ikTracks[o.id][2].keys.length,delta:after.reduce((sum,n,j)=>sum+Math.abs(n-before[j]),0),valid:after.every(Number.isFinite)}}''')
        assert result['keyframes']==3 and result['delta']>.001 and result['valid'];record('animatedIK',result)
        result=page.evaluate('''()=>{let o=getObj(),api=window.SPATIAL_MOTION_TEST,a=api.getMotion();a.tracks[o.id]=[{t:0,pos:[0,0,1],rot:[0,0,0],scale:[1,1,1]},{t:2,pos:[2,0,1],rot:[0,0,0],scale:[1,1,1]}];a.physics.enabled=false;let l=api.addNlaLayer();l.weight=.4;l.mode='add';api.seek(.5);let before=o.pos.slice();api.seek(.5);let after=o.pos.slice();l.mute=true;api.seek(.5);return{layers:a.nla.layers.length,repeatEqual:before.every((v,i)=>Math.abs(v-after[i])<1e-5),muteChange:Math.abs(o.pos[0]-before[0])}}''')
        assert result['layers']==1 and result['repeatEqual'] and result['muteChange']>0;record('NLAComposition',result)
        result=page.evaluate('''()=>{let o=getObj(),api=window.SPATIAL_MOTION_TEST,a=api.getMotion();a.nla.layers=[];a.tracks={};a.physics.enabled=true;a.duration=2;o.body={enabled:true,type:'dynamic',mass:2,bounce:.25,friction:.6,velocity:[0,0,0],basePos:[0,0,4]};api.seek(1);let p=o.pos.slice();api.seek(1);return{pos:p,deterministic:p.every((n,j)=>Math.abs(n-o.pos[j])<1e-7),finite:p.every(Number.isFinite)}}''')
        assert result['deterministic'] and result['finite'] and result['pos'][2]<4;record('fixedStepPhysics',result)
        result=page.evaluate('''()=>{let o=getObj(),s=serialize(),j=JSON.parse(s);loadProject(j);return{version:j.version,bones:getObj()?.rig?.bones.length||project.objects.find(x=>x.rig)?.rig.bones.length,hasIK:!!j.animations.ikTracks,hasRig:!!j.objects[0].rig,baseMesh:j.objects[0].mesh.positions.every(Number.isFinite),saveLength:s.length}}''')
        assert result['version']==4 and result['bones']==3 and result['hasIK'] and result['hasRig'] and result['baseMesh'];record('nativeRoundTrip',result)
        result=page.evaluate('''async()=>{const blob=await window.SPATIAL_MOTION_EXPORT_TEST.exportSkinnedGLB(),dv=new DataView(await blob.arrayBuffer()),length=dv.getUint32(12,true),buf=new Uint8Array(await blob.arrayBuffer()),j=JSON.parse(new TextDecoder().decode(buf.slice(20,20+length)));return{bytes:blob.size,skinCount:j.skins?.length,joints:j.skins?.[0]?.joints.length,attributes:Object.keys(j.meshes[0].primitives[0].attributes),validHeader:dv.getUint32(0,true)===0x46546c67}}''')
        assert result['validHeader'] and result['skinCount']==1 and result['joints']==3 and 'JOINTS_0' in result['attributes'] and 'WEIGHTS_0' in result['attributes'];record('skinnedGLB',result)
        for width,height in [(1440,900),(1024,768),(390,844),(320,640)]:
            page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(150)
            ui=page.evaluate('''()=>({body:document.body.scrollWidth,viewport:innerWidth,motion:!!document.querySelector('#motion24'),canvas:document.querySelector('#glcanvas').width})''')
            assert ui['body']<=width+12 and ui['motion'] and ui['canvas']>0,(width,height,ui)
        record('responsive',{'screenWidths':[1440,1024,390,320],'pass':True})
        assert not errors,errors
        record('uncaughtJavaScriptErrors',errors)
        browser.close()

if __name__=='__main__':
    try:
        run()
        (ROOT/'QA_Results_v24.json').write_text(json.dumps(report,indent=2))
    except Exception as ex:
        print('FAILED:',ex);(ROOT/'QA_Results_v24.json').write_text(json.dumps({'partial':report,'error':str(ex)},indent=2));sys.exit(1)
