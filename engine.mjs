import createOCCT from './occt.mjs';

export function solveCAD(oc, payload) {
  const resources = [];
  const hold = value => { resources.push(value); return value; };
  const objects = new Map(payload.objects.map(object => [object.id, object]));
  const shapes = new Map();
  const visiting = new Set();
  const point = p => hold(new oc.gp_Pnt(...p));
  const vector = p => hold(new oc.gp_Vec(...p));
  const progress = () => hold(new oc.Message_ProgressRange());
  const fail = message => { throw Error(message); };
  const apply = (m,p,w=1) => [0,1,2].map(i => m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]*w);
  const shapeOf = maker => {
    hold(maker);
    const shape = hold(maker.Shape());
    if (shape.IsNull()) fail('CAD construction returned an empty shape.');
    return shape;
  };
  function transform(shape, m) {
    const lengths=[0,4,8].map(i=>Math.hypot(m[i],m[i+1],m[i+2]));
    if(Math.min(...lengths)<=1e-9||Math.max(...lengths)-Math.min(...lengths)>1e-7*Math.max(...lengths))
      fail('This exact CAD shape requires equal X, Y and Z scale.');
    const tr = hold(new oc.gp_Trsf());
    tr.SetValues(...[0,1,2].flatMap(i => [m[i],m[i+4],m[i+8],m[i+12]]));
    return shapeOf(new oc.BRepBuilderAPI_Transform(shape,tr,true,false));
  }
  function sweep(face, delta) {
    return shapeOf(new oc.BRepPrimAPI_MakePrism(face,vector(delta),true,true));
  }
  function check(shape) {
    const solid = hold(new oc.TopExp_Explorer(shape,oc.TopAbs_ShapeEnum.TopAbs_SOLID,oc.TopAbs_ShapeEnum.TopAbs_SHAPE));
    if (!solid.More()) fail('The operation produced no solid volume.');
    const analyzer = hold(new oc.BRepCheck_Analyzer(shape,true,false,false));
    if (!analyzer.IsValid()) fail('OpenCascade found invalid geometry. Review profile shape, thickness and operand overlap.');
    return shape;
  }
  function boolean(a,b,mode) {
    const ctor = {union:oc.BRepAlgoAPI_Fuse,subtract:oc.BRepAlgoAPI_Cut,intersect:oc.BRepAlgoAPI_Common}[mode];
    if (!ctor) fail('Unknown exact Boolean operation.');
    const op = hold(new ctor(a,b,progress()));
    if (!op.IsDone()) fail('OpenCascade could not complete the Boolean.');
    return check(hold(op.Shape()));
  }
  function knots(count, degree) {
    const spans=count-degree;
    const values=hold(new oc.NCollection_Array1_double(1,spans+1));
    const multiplicities=hold(new oc.NCollection_Array1_int(1,spans+1));
    for(let i=0;i<=spans;i++){
      values.SetValue(i+1,i/spans);
      multiplicities.SetValue(i+1,i===0||i===spans?degree+1:1);
    }
    return [values,multiplicities];
  }
  function patchPrism(p,m) {
    const rows=p.controls.length,cols=p.controls[0].length;
    const poles=hold(new oc.NCollection_Array2_gp_Pnt(1,cols,1,rows));
    const weights=hold(new oc.NCollection_Array2_double(1,cols,1,rows));
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      poles.SetValue(x+1,y+1,point(apply(m,p.controls[y][x])));
      weights.SetValue(x+1,y+1,p.weights[y][x]);
    }
    const [u,um]=knots(cols,p.degreeU),[v,vm]=knots(rows,p.degreeV);
    const surface=hold(new oc.Geom_BSplineSurface(poles,weights,u,v,um,vm,p.degreeU,p.degreeV,false,false));
    const face=hold(new oc.BRepBuilderAPI_MakeFace(surface,1e-7));
    if(!face.IsDone())fail('The NURBS control net could not form a CAD face.');
    return sweep(hold(face.Face()),apply(m,[0,0,p.depth],0));
  }
  function make(object) {
    if(!object)fail('A linked CAD source is missing.');
    if(shapes.has(object.id))return shapes.get(object.id);
    if(visiting.has(object.id))fail('Cyclic CAD history.');
    visiting.add(object.id);
    const p=object.params,m=object.matrix;
    let shape;
    if(object.kind==='nurbs_prism'){
      shape=patchPrism(p,m);
    }else if(object.kind==='exact_boolean'){
      shape=boolean(make(objects.get(p.operandA)),make(objects.get(p.operandB)),p.operation);
      shape=transform(shape,m);
    }else if(object.kind==='derived'&&p.operation==='extrude'&&object.profile){
      const {points,plane}=object.profile;
      const normal=plane.n;
      const start=p.symmetric?-p.depth/2:0;
      const wire=hold(new oc.BRepBuilderAPI_MakePolygon());
      for(const q of points)wire.Add(point(apply(m,q.map((value,i)=>value+normal[i]*start))));
      wire.Close();
      if(!wire.IsDone())fail('The profile did not create a closed wire.');
      const face=hold(new oc.BRepBuilderAPI_MakeFace(hold(wire.Wire()),true));
      if(!face.IsDone())fail('Exact extrusion requires a planar closed profile.');
      shape=sweep(hold(face.Face()),apply(m,normal.map(v=>v*p.depth),0));
    }else if(object.kind==='primitive'){
      const lengths=[0,4,8].map(i=>Math.hypot(m[i],m[i+1],m[i+2]));
      if(Math.min(...lengths)<=1e-9||Math.max(...lengths)-Math.min(...lengths)>1e-7*Math.max(...lengths))
        fail('Exact primitive operations require equal X, Y and Z scale. Edit primitive dimensions for independent axis sizing.');
      if(p.shape==='box'){
        shape=shapeOf(new oc.BRepPrimAPI_MakeBox(point([-p.width/2,-p.depth/2,-p.height/2]),p.width,p.depth,p.height));
      }else if(p.shape==='sphere'){
        shape=shapeOf(new oc.BRepPrimAPI_MakeSphere(p.radius));
      }else if(p.shape==='torus'){
        shape=shapeOf(new oc.BRepPrimAPI_MakeTorus(p.radius,p.tube));
      }else if(p.shape==='cylinder'||p.shape==='cone'){
        const dir=hold(new oc.gp_Dir(0,0,1));
        const axis=hold(new oc.gp_Ax2(point([0,0,-p.height/2]),dir));
        shape=p.shape==='cone'?shapeOf(new oc.BRepPrimAPI_MakeCone(axis,p.radius,0.01,p.height))
          :shapeOf(new oc.BRepPrimAPI_MakeCylinder(axis,p.radius,p.height));
      }else fail('This primitive has no closed exact CAD representation.');
      shape=transform(shape,m);
    }else fail('Choose a CAD primitive, planar profile extrusion, NURBS prism or exact Boolean result.');
    visiting.delete(object.id);
    shapes.set(object.id,check(shape));
    return shape;
  }
  try {
    const a=make(objects.get(payload.a));
    const result=payload.operation?boolean(a,make(objects.get(payload.b)),payload.operation):a;
    if(payload.step){
      const millimetres=transform(result,[1000,0,0,0,0,1000,0,0,0,0,1000,0,0,0,0,1]);
      const writer=hold(new oc.STEPControl_Writer());
      const done=oc.IFSelect_ReturnStatus.IFSelect_RetDone;
      if(writer.Transfer(millimetres,oc.STEPControl_StepModelType.STEPControl_AsIs,true,progress())!==done ||
         writer.Write('/model.step')!==done)fail('STEP export failed.');
      return oc.FS.readFile('/model.step');
    }
    hold(new oc.BRepMesh_IncrementalMesh(result,0.008,true,0.3,false));
    const writer=hold(new oc.StlAPI_Writer());
    if(!writer.Write(result,'/preview.stl',progress()))fail('Could not tessellate the CAD result.');
    return oc.FS.readFile('/preview.stl');
  } finally {
    for(const name of ['/model.step','/preview.stl'])try{oc.FS.unlink(name)}catch{}
    for(const object of resources.reverse())object.delete();
  }
}

export function initializeCAD(options) {
  return createOCCT(options);
}
