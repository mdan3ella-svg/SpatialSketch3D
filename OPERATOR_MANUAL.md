# SPATIAL SKETCH 3D v2.4 — Motion Lab Operator Manual

## 1. Begin
Open `index.html`, choose New Sketch or open the editable **KINETIC RIG 02** demonstration. Click **Timeline** in the application header. The motion editor appears in the lower dock and can be scrolled without losing the camera view. Hide the timeline to maximize the model viewport.

## 2. Auto-rig and skeletal editing
Create/import a mesh, select it in the scene or outliner, then choose **Skeleton + IK**. Pick a **Humanoid proportions**, **Quadruped**, or **Articulated chain** template. Choose **Smooth envelopes** for deformable meshes or **Rigid connected shells** for hard-surface connected mesh components, and press **Auto-rig selected mesh**. A colored armature appears on the selected object.

Select a bone from the drop-down, or **Shift-click its armature line**. Edit X/Y/Z bone rotation numerically. Use **◆ Key bone** at different timeline times to create FK animation. The rest-pose button resets the bone angles; to preserve a new pose through playback, key it.

The auto-rigger places template bones according to the selected mesh's bounding box. It cannot infer accurate human anatomy, joint hardware, or separate imported object relationships by itself. For imported hard-surface designs, keep shell pieces disconnected within the same mesh to assign a rigid weight per connected component. The live CPU skinning ceiling is 28,000 vertices per rigged object.

## 3. IK target and target animation
Choose the end bone of a connected chain and a chain length of 2 or 3. Enter an IK target in **the mesh's local coordinate system** and click **Solve IK**. The FABRIK solver preserves bone segment lengths and positions the chain tip toward the target, unless the target is beyond reach.

To animate IK, select a time, enter X/Y/Z target coordinates, press **◆ Key IK target**. Repeat at additional frames. Existing IK targets for the selected bone are displayed as clickable time markers. Use **Delete IK key** at the chosen keyframe to remove it. Timeline playback and scrubbing continuously solve keyed IK targets.

## 4. NLA action layers
First key an object using the primary timeline or create bone rotation keys. Select the object, switch to **NLA Layers**, and click **+ Layer from selected action**. Action clips copy the selected object's current transform and bone key tracks. Each layer has an editable name, Start, End, Offset, Speed, Weight, Loop, Mute and Solo, and **Override** or **Additive** mixing.

Add layers to blend actions. Additive clips are measured relative to their first key; override clips interpolate from the underlying pose. A muted layer is skipped; when at least one layer is soloed, only solo layers are evaluated. Change source keys through the primary timeline/bone controls, then create an updated action clip if you want a distinct copy. The NLA editor does not offer a graph curve editor or retargeting system.

## 5. Physics playback
Switch to **Physics**. Enable physics, specify gravity in the Z direction and a ground Z elevation. Select a mesh, enable **Simulate selected object**, choose Dynamic or Kinematic, and set Mass, Bounce, Friction, and initial Velocity X/Y/Z. Click **Set initial pose** to make the current resting pose the start state.

Press Play or scrub the timeline. The engine integrates fixed 1/60-second steps, ground collision, and axis-aligned body contacts. Dynamic objects respond to gravity and contacts; kinematic bodies remain fixed at their animation pose. It does not model angular momentum, revolute joint forces, accurate geometry-to-geometry collision, constraint motors, self-collision, or certified rigid-body dynamics.

## 6. Export a skinned GLB
Open **Video + GLB** and select **Export skinned GLB**, or use the regular GLB export action when skinned objects exist. The output includes glTF skin nodes, `JOINTS_0`, `WEIGHTS_0`, inverse bind matrices and sampled bone rotation tracks. The native project is the canonical editable source for weights, rig templates, IK, NLA and physics; exported GLB cannot retain every native motion-controller concept.

## 7. Export H.264 MP4
Set output width (640 / 960 / 1280) and 24 or 30 FPS, then press **Export MP4 (H.264)**. The app first checks WebCodecs H.264 if available, otherwise the browser's native MP4 recording path. Supported output is locally encoded with no external service. Videos are capped at 30 seconds in this edition. **Export WebM** remains available in the older timeline controls. The panel reports unsupported encoders instead of silently relabeling WebM as MP4.

## 8. Saving, restoration and validation
Save a `.spatialsketch.json` project to preserve rest mesh geometry, bone hierarchy, vertex weights, IK targets, NLA clips, physics settings, other modeling data, and cameras. v2.3 projects continue to load. The bundled `tests/test_motion_v24.py` reproduces basic skinning, IK, NLA, collision, native serialization, skin GLB and responsive layout tests.

## Known limitations
This edition uses CPU skinning and simplified AABB physics. It does not include skeletal retargeting, interactive brush weight painting, complex anatomical inference, NLA audio sync, professional collision constraints, GPU-compute dynamics, or built-in FBX rig interchange. Full GPU rendering and external skeletal playback compatibility are not independently certified.
