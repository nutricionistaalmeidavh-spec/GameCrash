"""Simplified Serra do Rio do Rastro with successive hairpin bends."""
import trimesh
from .geometry import box,tree
from .roads import segment

def build():
    s=trimesh.Scene()
    box(s,"mountain_base",(0,-3,0),(420,5,420),"#628557")
    route=[[0,55,170],[0,52,135],[48,49,106],[66,46,76],
       [27,43,53],[-30,40,42],[-70,37,15],[-63,34,-23],
       [-20,31,-35],[42,28,-49],[74,25,-79],[40,22,-106],
       [-15,19,-111],[-57,16,-132],[-40,13,-154],[0,10,-169]]
    for a,b in zip(route,route[1:]):segment(s,a,b,12)
    for i,(x,y,z) in enumerate(route):
        if i%2==0:
            tree(s,x+17,max(0,y-13),z)
            tree(s,x-17,max(0,y-13),z)
    box(s,"mountain_east",(120,28,-22),(80,56,175),"#82897e")
    box(s,"mountain_west",(-136,23,-38),(88,46,180),"#737d70")
    obstacles=[]
    for i in (5,12):
        x,y,z=route[i]
        box(s,"COLLIDER_barrier",(x,y+.55,z),(2.3,1.1,1.2),"#bd4338")
        obstacles.append([x,y,z])
    return s,{"name":"Serra do Rio do Rastro - SC",
       "spawn":{"position":[0,55.9,170],"yawRad":0},
       "route":route,"obstacles":obstacles,
       "locationInspired":True,"geographicallyExact":False}
