#!/usr/bin/env python3
"""Build self-contained Spatial Sketch 3D v2.4 with offline motion tools."""
from pathlib import Path
root=Path(__file__).resolve().parent
source=root/'source_parts'
core=['part01_shell.html','part02_geometry.js','part03_renderer.js','part04_app.js','part05_io_demo.js']
additional=['part06_csg_nurbs.js','part07_bake_trace.js','part08_animation_drawings.js','part09_advanced_ui.js','part10_responsive_layout.js']
s=''.join((source/name).read_text(encoding='utf-8') for name in core)
assert s.rstrip().endswith('</script></body></html>')
addon='\n<script>\n'+'\n'.join((source/n).read_text(encoding='utf-8') for n in additional)+'\n</script>\n'
s=s.replace('</body></html>',addon+'</body></html>')
styles=(source/'part11_gizmo_styles.css').read_text(encoding='utf-8')
script=(source/'part11_navigation_gizmos.js').read_text(encoding='utf-8')
s=s.replace('</head>','<style id="spatialControlsCSS">\n'+styles+'\n</style></head>',1)
old="if(plane.label==='YZ')matrix=[0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,1]"
new="if(plane.label==='YZ')matrix=[0,1,0,0,0,0,1,0,1,0,0,0,0,0,0,1]"
assert old in s
s=s.replace(old,new)
s=s.replace('</body>','<script id="spatialControlsJS">\n'+script+'\n</script>\n</body>',1)
anim=(source/'part12_animation_engine.js').read_text(encoding='utf-8')
s=s.replace('</body>','<script id="spatialAnimationV23JS">\n'+anim+'\n</script>\n</body>',1)
motion=(source/'part13_rig_ik_nla_physics.js').read_text(encoding='utf-8')
media=(source/'part14_rig_export_mp4.js').read_text(encoding='utf-8')
s=s.replace('</body>','<script id="spatialMotionV24JS">\n'+motion+'\n'+media+'\n</script>\n</body>',1)
s=s.replace('v2.1.1 — adaptive shell','v2.2 — adaptive shell')
s=s.replace('2.1.1 Responsive','2.4 Motion Lab').replace('PATCH v2.1.1','PATCH v2.4')
s=s.replace('2.2 Controls','2.4 Motion Lab')
s=s.replace('<title>SPATIAL SKETCH 3D','<title>SPATIAL SKETCH 3D v2.4')
for name in ['index.html','Spatial_Sketch_3D_v2_4_Advanced_Motion.html']:
    (root/name).write_text(s,encoding='utf-8')
print('Built',len(s.encode()),'bytes')
