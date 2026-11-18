# Design Studio 3.0 verification

## Passed

- Parsed and executed all bundled application scripts in a DOM harness. Exercised launch, workspace switching, the command search, primitive creation, sketch and geometry controls, object selection through the outliner, native scene validation, undo and redo.
- Ran all five inherited concept demos and reloaded an exported presentation. Verified that model content survived and runtime panels were created only once.
- Tested Manifold union, subtraction and intersection on an overlapping box and sphere. Verified closure and positive volume. Also cut with a mirrored operand.
- Rejected a negative NURBS weight while keeping the previous control net. Accepted a positive weight and regenerated the surface.
- Ran exact box/cylinder union, cut and intersection with the shipped OpenCascade WebAssembly module. Built an exact weighted NURBS solid, cut it with a cylinder and inspected the generated STEP for solid and rational B-spline entities. Exercised the app's Model controls with an emulated worker transport backed by the actual kernel.
- Rejected a malformed native project with out-of-range mesh indices without replacing the open scene.

## Issues corrected

- Degenerate sphere pole triangles blocked use as solid Boolean operands.
- Picking compared ray distances in differently scaled local spaces.
- Editing sampled points of a NURBS curve left its rational control net stale.
- NURBS regeneration now validates control values and reuses basis vectors during surface tessellation.
- Failed sketch regeneration retains the last valid preview.
- The exported interactive HTML now starts from the clean application scaffold, so generated controls are initialized once.

## Coverage

The runtime checks used a DOM harness with canvas substituted. A live GPU viewport, cross-browser layout, hosted GitHub Pages deployment, codecs, and all inherited GLB/rigging and rendering formats still need their own end-to-end checks.
