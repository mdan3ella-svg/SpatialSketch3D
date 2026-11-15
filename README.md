# SPATIAL SKETCH 3D v2.4 — MOTION LAB

A VERTASCAN Creative Technology Application · Design Without Boundaries

## Quick start

Open `index.html` in Chrome, Edge, or Firefox. All application JavaScript, CSS, and geometry routines are bundled locally; the application does not require a CDN or cloud service. For GitHub Pages upload `index.html` to the repository root.

Go to **Timeline** → **MOTION LAB · 2.4** to access **Skeleton + IK**, **NLA Layers**, **Physics**, and **Video + GLB**. Open `demos/KINETIC_RIG_02_Editable_Demo.spatialsketch.json` from **Open Project** to try rigging, animated IK, an NLA action layer, and dynamic collisions together.

## What's new

- Three editable bone-layout generators: generic humanoid proportions, quadruped, and articulated chain. Bounds-based placement; NOT semantic/anatomical model interpretation.
- Smooth envelope weights (four influences per vertex) or rigid weights for disconnected shells. Weights and rest positions are stored in the native project.
- FK bone rotation, selectable colored armature overlay, FABRIK IK on two- and three-bone chains, animated IK target keys.
- Multilayer NLA action clips supporting object transform and bone tracks, weighted override or additive mixing, looping, speed, offset, mute and solo.
- Fixed-step gravity, ground and AABB body contacts, mass, bounce, friction and initial velocities; timeline scrubbing evaluates from the initial state.
- GLB 2.0 skin export (JOINTS_0, WEIGHTS_0, bone node hierarchy, inverse bind matrices, bone rotation animation channels), alongside earlier GLB object transform tracks.
- Real H.264 MP4 export using built-in browser H.264 MediaRecorder support, or WebCodecs + inlined ISO BMFF muxer on devices that support it. Existing WebM export retained.
- Responsive motion editor dock with independent scroll, preserving usable 3D viewport space.

## Deliverables

- `index.html` / `Spatial_Sketch_3D_v2_4_Advanced_Motion.html` — fully inlined application.
- `source_parts/part01...part14` — complete application source modules, geometry and motion extensions.
- `demos/KINETIC_RIG_02_Editable_Demo.spatialsketch.json` — editable native motion demo.
- `demos/KINETIC_RIG_02_Skinned_Animated.glb` — generated glTF skeletal asset.
- `demos/KINETIC_RIG_02_H264_Motion_Sample.mp4` — actual locally encoded H.264 sample.
- `tests/test_motion_v24.py`, `tests/QA_Results_v24.json` — reproducible functional checks.
- `OPERATOR_MANUAL.md`, `QA_REPORT.md`, `CHANGELOG.md` — documentation.

## Rebuild

Run `python build.py` at the package root to regenerate `index.html` from the complete `source_parts` collection. Does not fetch any dependencies. Open HTML directly for offline use or host under HTTPS to enable all available browser media APIs.

## Caveats

This is an interactive advanced development edition, not a professional animation suite or certified dynamics package. Automatic rigging is heuristic, IK lacks pole-vector constraints and robust foot contact, physics is axis-aligned translation-only, GPU skinning is not implemented, and heavy models can be slow. CPU live skinning is limited to 28,000 vertices per selected mesh. MP4 requires a browser that provides H.264; the export UI reports codec support. The current video UI caps output at 1280×720 and 30 seconds. Native project files preserve editable rig/NLA/physics state. GLB reimport does not currently reconstruct editable rigs or NLA layers.
