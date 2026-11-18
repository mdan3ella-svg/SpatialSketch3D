# OpenCascade WebAssembly

This CAD add-on redistributes the unmodified single-threaded JS and WebAssembly
builds from `replicad-opencascadejs@1.2.1`. The JS loader was renamed to
`occt.mjs`. The binary retains its upstream filename and is loaded at runtime
through a separate worker.

- Published build and license · https://www.npmjs.com/package/replicad-opencascadejs/v/1.2.1
- Build source and configuration · https://github.com/sgenoud/replicad/tree/main/packages/replicad-opencascadejs
- OpenCascade source and releases · https://github.com/Open-Cascade-SAS/OCCT
- OpenCascade.js WebAssembly bindings · https://github.com/donalffons/opencascade.js

See LICENSE for the applicable license text. The application integration in
`engine.mjs` and `worker.mjs` is provided as readable JavaScript. The loader
and binary can be replaced together with a compatible build.
