import {initializeCAD,solveCAD} from './engine.mjs';

let kernel;
self.onmessage=async ({data})=>{
  try {
    kernel ??= initializeCAD({locateFile:name=>new URL(name,import.meta.url).href});
    const bytes=solveCAD(await kernel,data);
    self.postMessage({bytes},[bytes.buffer]);
  }catch(error){
    self.postMessage({error:error?.message||'OpenCascade rejected the geometry.'});
  }
};
