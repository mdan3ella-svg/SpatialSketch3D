#!/usr/bin/env python3
"""SPATIAL SKETCH 3D | Optional exact CAD (OpenCascade/CadQuery) geometry bridge.

Command line:
    python exact_brep_backend.py --input Concept.spatialsketch.json --output Concept_exact.step

Converts supported parametric primitives, planar profile extrusions, and Boolean
construction histories to OpenCascade B-rep solids. Exports a STEP assembly with
units in millimetres. Reports unsupported entities rather than substituting a
triangulated mesh. Does NOT certify engineering designs or documentation.

Requires CadQuery >= 2.4 (which embeds the OpenCascade modeling kernel).
"""
import argparse
import json
import math
import sys
from pathlib import Path

try:
    import cadquery as cq
except ImportError as exc:
    raise SystemExit('CadQuery is required: pip install cadquery (or use its managed environment)') from exc

UNITS_TO_MM={'m':1000.0,'cm':10.0,'mm':1.0,'ft':304.8,'in':25.4}


def vec(values):
    if len(values)!=3 or not all(math.isfinite(float(v)) for v in values):
        raise ValueError('Expected finite XYZ coordinate')
    return cq.Vector(*[float(x) for x in values])


def shape_valid(shape):
    if not shape.isValid():
        raise ValueError('CAD kernel returned an invalid B-rep')
    solids=shape.Solids()
    if not solids:
        raise ValueError('Result is not a B-rep solid')
    return shape


class CADBridge:
    def __init__(self, data):
        self.data=data
        self.objects={obj['id']:obj for obj in data.get('objects',[]) if 'id' in obj}
        self.cache={}
        self.inflight=set()
        self.units=UNITS_TO_MM.get(data.get('unit','m'),1000.0)
        self.failures={}

    def primitive(self,obj):
        p=obj.get('params',{})
        kind=p.get('shape','')
        w=float(p.get('width',2))
        d=float(p.get('depth',2))
        h=float(p.get('height',2))
        r=float(p.get('radius',1))
        t=float(p.get('tube',.24))
        if min(w,d,h,r,t)<=0:
            raise ValueError('Primitive dimensions must be strictly positive')
        if kind=='box':
            return cq.Workplane('XY').box(w,d,h).val()
        if kind=='sphere':
            return cq.Solid.makeSphere(r,angleDegrees1=-90,angleDegrees2=90)
        if kind=='cylinder':
            return cq.Solid.makeCylinder(r,h,cq.Vector(0,0,-h/2))
        if kind=='cone':
            return cq.Solid.makeCone(r,0.0001,h,cq.Vector(0,0,-h/2))
        if kind=='torus':
            return cq.Solid.makeTorus(r,t)
        raise ValueError('No exact solid constructor for primitive '+str(kind))

    def extrusion(self,obj):
        params=obj.get('params',{})
        if params.get('operation')!='extrude':
            raise ValueError('Exact bridge supports planar sketch extrusion only (other derived forms remain mesh geometry)')
        source=self.objects.get(obj.get('source'))
        if not source or source.get('kind')!='sketch':
            raise ValueError('Missing linked source sketch')
        sk=source.get('params',{})
        if not sk.get('closed'):
            raise ValueError('Source sketch not closed')
        points=sk.get('points',[])
        if len(points)<3:
            raise ValueError('Closed sketch has fewer than three vertices')
        n=vec(sk.get('plane',{}).get('n',[0,0,1])).normalized()
        origin=vec(points[0])
        for xyz in points:
            if abs((vec(xyz)-origin).dot(n))>1e-5:
                raise ValueError('Nonplanar source profile cannot be extruded as a planar exact face')
        perimeter=[vec(p) for p in points]
        if (perimeter[0]-perimeter[-1]).Length>1e-8:
            perimeter.append(perimeter[0])
        wire=cq.Wire.makePolygon(perimeter)
        face=cq.Face.makeFromWires(wire)
        depth=float(params.get('depth',2))
        if abs(depth)<1e-6:
            raise ValueError('Extrusion depth is zero')
        solid=cq.Solid.extrudeLinear(face,n.multiply(depth))
        if params.get('symmetric'):
            solid=solid.translate(n.multiply(-depth/2))
        return solid

    def apply_transform(self,solid,obj):
        pos=[float(v) for v in obj.get('pos',[0,0,0])]
        rot=[float(v) for v in obj.get('rot',[0,0,0])]
        sc=[float(v) for v in obj.get('scale',[1,1,1])]
        if max(sc)-min(sc)>1e-8 or min(sc)<=0:
            raise ValueError('Exact backend supports positive uniform scale; nonuniform or reflected solids require explicit CAD remodeling')
        if abs(sc[0]-1)>1e-9 or abs(self.units-1)>1e-9:
            solid=solid.scale(sc[0]*self.units)
        for degrees,axis in zip(rot,[(1,0,0),(0,1,0),(0,0,1)]):
            if degrees:
                solid=solid.rotate((0,0,0),axis,degrees)
        solid=solid.translate(tuple(v*self.units for v in pos))
        return shape_valid(solid)

    def apply_world_transform_mm(self,solid,obj):
        """Transform a Boolean already expressed in kernel millimetre coordinates."""
        pos=[float(v) for v in obj.get('pos',[0,0,0])]
        rot=[float(v) for v in obj.get('rot',[0,0,0])]
        sc=[float(v) for v in obj.get('scale',[1,1,1])]
        if max(sc)-min(sc)>1e-8 or min(sc)<=0:
            raise ValueError('Boolean result requires positive uniform scale')
        if abs(sc[0]-1)>1e-9:
            solid=solid.scale(sc[0])
        for degrees,axis in zip(rot,[(1,0,0),(0,1,0),(0,0,1)]):
            if degrees:
                solid=solid.rotate((0,0,0),axis,degrees)
        return shape_valid(solid.translate(tuple(v*self.units for v in pos)))

    def evaluate(self,obj_id):
        if obj_id in self.cache:return self.cache[obj_id]
        if obj_id in self.inflight:raise ValueError('Circular Boolean dependency')
        self.inflight.add(obj_id)
        try:
            obj=self.objects.get(obj_id)
            if obj is None:raise ValueError('Unknown object '+obj_id)
            kind=obj.get('kind','')
            if kind=='primitive':
                solid=self.apply_transform(self.primitive(obj),obj)
            elif kind=='derived':
                solid=self.apply_transform(self.extrusion(obj),obj)
            elif kind=='boolean':
                p=obj.get('params',{})
                a=self.evaluate(p.get('operandA'))
                b=self.evaluate(p.get('operandB'))
                op=p.get('operation')
                if op=='union':solid=a.fuse(b)
                elif op=='subtract':solid=a.cut(b)
                elif op=='intersect':solid=a.intersect(b)
                else:raise ValueError('Unknown Boolean operation '+str(op))
                solid=shape_valid(solid)
                if obj.get('rot',[0,0,0])!=[0,0,0] or obj.get('scale',[1,1,1])!=[1,1,1] or obj.get('pos',[0,0,0])!=[0,0,0]:
                    solid=self.apply_world_transform_mm(solid,obj)
            else:
                raise ValueError('No exact surface constructor for '+kind)
            self.cache[obj_id]=solid
            return solid
        finally:
            self.inflight.discard(obj_id)

    def export(self,output:Path):
        asm=cq.Assembly(name='SpatialSketch3D_Exact_BREP')
        done=[]
        for obj in self.data.get('objects',[]):
            if not obj.get('visible',True) or obj.get('kind')=='sketch':continue
            try:
                solid=self.evaluate(obj['id'])
                asm.add(solid,name='SS_'+obj['id']+'_'+''.join(ch if ch.isalnum() else '_' for ch in obj.get('name','Solid'))[:40])
                done.append(dict(name=obj.get('name'),id=obj['id'],solids=len(solid.Solids()),volume_mm3=solid.Volume(),valid=solid.isValid()))
            except (ValueError,RuntimeError,IndexError,TypeError) as exc:
                self.failures[obj.get('name',obj.get('id','?'))]=str(exc)
        if not done:
            raise ValueError('No eligible exact solids to export: '+str(self.failures))
        output.parent.mkdir(parents=True,exist_ok=True)
        asm.save(str(output),exportType='STEP')
        if output.suffix.lower()=='.step':
            brep_path=output.with_suffix('.brep')
            try:
                if len(done)==1:
                    cq.exporters.export(self.cache[done[0]['id']],str(brep_path),'BREP')
            except Exception:
                pass
        report=dict(project=self.data.get('name'),kernel='OpenCascade through CadQuery',units='mm',output=str(output),exact_solids=done,unconverted=self.failures,professionally_certified=False)
        report_path=output.with_suffix('.exact_report.json')
        report_path.write_text(json.dumps(report,indent=2))
        return report


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--input',required=True,type=Path)
    ap.add_argument('--output',required=True,type=Path)
    args=ap.parse_args()
    data=json.loads(args.input.read_text(encoding='utf-8'))
    report=CADBridge(data).export(args.output)
    print(json.dumps(report,indent=2))
    if report['unconverted']:
        print('WARNING: Unsupported objects were reported and omitted; inspect the JSON report.',file=sys.stderr)

if __name__=='__main__':
    main()
