# SPATIAL SKETCH 3D v2.4 — Quality Assurance Report

## Verified in headless Chromium (software renderer)

| Test | Result |
|---|---|
| Standalone HTML initializes, new controls mount | PASS |
| Automatic 3-bone chain creation with 36/36 vertex weights | PASS |
| Smooth FK deformation, all finite vertex coordinates | PASS |
| Rigid connected-shell weights: one 100% influence per vertex | PASS |
| FABRIK target reachable within 0.002 model units | PASS — measured error 0.000042 |
| Animated IK target keys modify vertices over time | PASS |
| NLA additive mixing deterministic on repeated scrub | PASS |
| NLA mute changes final pose | PASS |
| Fixed-step gravity simulation deterministic and finite | PASS |
| Native JSON save/reopen preserves bones, IK, NLA, physics | PASS |
| Exported GLB includes glTF skin, bone nodes and JOINTS_0 / WEIGHTS_0 | PASS |
| Responsive layouts at 1440, 1024, 390 and 320 screen widths | PASS |
| Uncaught JavaScript errors during these tests | NONE |
| H.264 MP4 output recorded in Chromium and inspected with ffprobe | PASS |
| Real MP4 format/codec | PASS: `ftyp` container, h264, 640x360, 2.487 s sample |
| Skeletal GLB exported from editable rig demo | PASS: 1 skin, 3 sampled bone animation channels |
| GLB independently loaded using trimesh | PASS: 4 mesh geometry sets |

## Testing environment

Headless Chromium with software rendering and local self-contained HTML. Generated H.264 sample validated through FFmpeg `ffprobe`. Demo project contains 4 objects, a 3-bone envelope rig, 4 keyed IK targets, one NLA layer and two physical bodies.

## Limits / outstanding validation

- No GPU-enabled browser hardware profiling or browser-matrix certification.
- Rig templates are generated from bounding boxes, not semantic joint detection or physically plausible anatomy.
- Physics uses AABB contacts and translational impulse approximations only. There is no angular rigid-body dynamics, mesh collision narrow phase, persistent joint constraints or mechanical torque certification.
- GPU-accelerated skinning, retargeting, animation graph curves, advanced NLA blending/constraints and professional joint motor physics are not implemented.
- The WebCodecs H.264 MP4 muxer path was implemented but not executed in the insecure-context headless test; native browser MediaRecorder H.264 MP4 output was verified. On unsupported browsers the app reports codec unavailability.
- GLB skin structure and geometry loading were independently checked, but externally animated playback in Blender, Unity and Unreal remains unverified. GLB reimport does not reconstruct native editable skeletons.
- Previous advanced B-rep, drawing certification and some geometry/interchange limitations from earlier audits remain separate from this animation-focused release.

**Classification:** Functional development upgrade, not independently certified 5A+ production software.
