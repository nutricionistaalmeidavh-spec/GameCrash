"""Utilities for sloped road meshes in GLB assets."""
import numpy as np
import trimesh
from .geometry import add

def segment(scene,start,end,width=12):
    a=np.asarray(start,float)
    b=np.asarray(end,float)
    vec=b-a
    length=float(np.linalg.norm(vec))
    if length<0.01:return
    rotation=trimesh.geometry.align_vectors([0,0,1],vec/length)
    for name,size,color,height in [
        ("COLLIDER_road",[width,.25,length+.3],"#545a5d",-.11),
        ("centerline",[.12,.04,length+.3],"#efe6ce",.045)]:
        geo=trimesh.creation.box(extents=size)
        geo.apply_transform(rotation)
        geo.apply_translation((a+b)/2+[0,height,0])
        add(scene,geo,name,color)
