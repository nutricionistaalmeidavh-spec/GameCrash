"""Fictionalized Eixo Monumental in Brasilia, not survey data."""
import trimesh
from .geometry import box,tree,tube

def build():
    s=trimesh.Scene()
    box(s,"ground",(0,-.5,0),(350,.8,400),"#7aa36f")
    box(s,"COLLIDER_road",(0,-.10,0),(30,.22,380),"#51575e")
    box(s,"median",(0,.04,0),(1.6,.08,375),"#7ca36b")
    for z in range(-180,181,12):
        for x in (-12,-8,-4,4,8,12):
            box(s,"lane_dash",(x,.04,z),(.12,.03,4),"#e9e7db")
        if z%24==0:
            tree(s,-21,0,z);tree(s,21,0,z)
    for z in range(-145,146,29):
        for x in (-49,49):
            h=16+(abs(z)//29%3)*7
            box(s,"city_building",(x,h/2,z),(21,h,19),"#c9d0d5")
            box(s,"glass_facade",(x,h*.61,z-9.53),(17,h*.49,.07),"#70a0ad")
    for x in (-4,4):
        box(s,"tower",(x,23,-180),(5.5,46,8),"#e9e9e6")
    tube(s,"congress_bowl",(-18,3,-180),11,6,"#eee6d4")
    tube(s,"congress_bowl",(18,3,-180),11,6,"#eee6d4")
    box(s,"COLLIDER_obstacle",(-6,.5,-18),(2.7,1,1.3),"#b84239")
    box(s,"COLLIDER_ramp",(5,.24,-80),(4,.48,8),"#ae8952")
    return s,{"name":"Eixo Monumental - Brasilia","spawn":{"position":[-5,.85,170],"yawRad":0},
       "route":[[-5,0,z] for z in range(170,-170,-8)],"obstacles":[[-6,0,-18],[5,0,-80]],
       "locationInspired":True,"geographicallyExact":False}
