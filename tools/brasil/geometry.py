"""Reusable geometry for GameCrash Brazil assets (Y-up, meters)."""
import math
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

CACHE={}
def material(color):
    if color not in CACHE:
        c=color.lstrip("#")
        rgb=[int(c[i:i+2],16)/255 for i in (0,2,4)]
        CACHE[color]=PBRMaterial(baseColorFactor=[*rgb,1],roughnessFactor=.79,doubleSided=True)
    return CACHE[color]

def add(scene,geo,name,color):
    geo.visual=TextureVisuals(material=material(color))
    n=len(scene.geometry)
    scene.add_geometry(geo,geom_name=f"{name}_{n:04d}",node_name=f"{name}_{n:04d}")

def box(scene,name,position,dimensions,color):
    g=trimesh.creation.box(extents=dimensions)
    g.apply_translation(position)
    add(scene,g,name,color)

def tube(scene,name,position,radius,height,color,axis="Y"):
    g=trimesh.creation.cylinder(radius=radius,height=height,sections=12)
    if axis=="Y":g.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,[1,0,0]))
    if axis=="X":g.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,[0,1,0]))
    g.apply_translation(position)
    add(scene,g,name,color)

def tree(scene,x,y,z):
    tube(scene,"tree_trunk",(x,y+2,z),.22,4,"#6b513e")
    tube(scene,"tree_foliage",(x,y+5,z),1.65,3.6,"#437b43")
