# Spatial Sketch 3D · Design Studio 3.0

## Open or publish

Extract both ZIP parts into the same folder. Keep `index.html` and `cad/` side by side. Part 1 runs by itself for sketching, mesh modeling, motion and presentation.

- **Offline single file** · Open `index.html` directly in a browser. Mesh Booleans use an embedded Manifold WebAssembly build.
- **Local with exact CAD** · From the extracted folder, run `python -m http.server 8000` and open [http://localhost:8000](http://localhost:8000). The OpenCascade worker and WebAssembly are served from the local folder.
- **GitHub Pages** · Commit `index.html`, `.nojekyll` and the complete `cad/` folder at the root of the publishing branch. In **Settings → Pages**, select **Deploy from a branch**, choose the branch and **/(root)**, then save. The CAD worker uses paths relative to the project page. [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

```text
index.html
.nojekyll
README.md
QA.md
cad/
  engine.mjs
  worker.mjs
  occt.mjs
  replicad_single.wasm
  LICENSE
  THIRD_PARTY.md
```

## Workspaces

| Workspace | Use it for |
| --- | --- |
| Sketch | Draw in a construction plane, set grid snap and edit profile points |
| Model | Build primitives, extrude or revolve profiles, run Booleans and edit NURBS |
| Render | Save cameras, render images, bake maps and trace a scene |
| Motion | Open the timeline, key objects and use the inherited animation and rigging tools |
| Drawings | Change projection, open four views and create an A3 drawing |

Open **Commands** with `Ctrl+K` or `Cmd+K`. Search for a tool and press Enter to run the first match. Use **Properties** for numeric transforms and geometry parameters. Use **Scene objects** to select or reveal hidden operands. Use **Modify selection** for a linear array or to place geometry on the ground plane.

## Model a cut through a NURBS solid

1. Open the hosted or locally served build with both ZIP parts installed.
2. Choose **Model → NURBS & STEP → Create patch**. In **Properties**, enter XYZ coordinates and positive rational weights in the control table. Choose **Apply controls**.
3. Choose **Solid from patch** and enter the local Z depth. The solid is an exact swept CAD face. Use a regular patch without folds along that direction.
4. Create and place a cutter. For example, place a cylinder so it passes through the curved solid.
5. Under **Boolean operations**, choose **OpenCascade · exact B-rep**. Assign the NURBS solid to **A · Base** and the cutter to **B · Tool**. Choose **Subtract · A − B**.
6. Select the result and choose **Export STEP**. The STEP file contains the CAD geometry in millimetres. The viewport uses a tessellated preview and project coordinates in metres.
7. To change the cutter later, use **Reveal sources**, edit its properties and choose **Rebuild from operands** on the Boolean result. Turning a patch into a solid takes a snapshot of its control net. After further patch edits, create a new solid from that patch.

## Geometry support

- **Manifold mesh** performs geometric union, difference and intersection on closed triangle meshes. Use it for watertight imported meshes and supported procedural solids. Open surfaces must be closed before use as solid operands.
- **OpenCascade B-rep** supports boxes, spheres, cylinders, the existing tapered cone, tori, simple planar polygon extrusions, NURBS patch sweeps and exact Boolean results. Use the primitive dimensions for independent axis sizing. The exact primitive and exact Boolean result transform supports uniform scale. Use the mesh kernel for imported triangle models.
- **NURBS** uses open-clamped knots. The loft uses two open profiles with corresponding control vertices. When both profiles are rational NURBS, use matching U degrees.
- **Editable project JSON** stores objects, NURBS controls and Boolean source links. GLB, OBJ and STL export tessellated geometry. Export STEP for a selected exact solid and save the project JSON for continued editing.
- Existing motion, rendering and drawing tools are retained. Movie encoding and viewport acceleration depend on browser support.

See **QA.md** for the checks run on this release and remaining coverage.
