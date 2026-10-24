"""Simplified Rodovia dos Imigrantes landscape and bridges."""
import math
import trimesh
from .geometry import box,tube,tree
from .roads import segment

def build():
    s=trimesh.Scene()
    box(s,"valley",(0,-3,0),(360,6,395),"#5e8b55")
    route=[[12*math.sin(i*.18),35-i*.9,168-i*11] for i in range(31)]
    for a,b in zip(route,route[1:]):segment(s,a,b,14)
    for i,(x,y,z) in enumerate(route):
        if i%3==0:
            tree(s,x-18,max(0,y-12),z)
            tree(s,x+18,max(0,y-12),z)
            tube(s,"bridge_pillar",(x,y/2-1,z),1.5,max(2,y+2),"#b3b8b4")
    x,y,z=route[18]
    box(s,"tunnel_top",(x,y+7,z),(20,2,9),"#b2b9b4")
    for direction in (-1,1):
        box(s,"tunnel_side",(x+direction*9,y+3,z),(2,6,9),"#b2b9b4")
    obstacles=[]
    for i in (14,24):
        x,y,z=route[i]
        box(s,"COLLIDER_barrier",(x+2,y+.6,z),(2.3,1.2,1.4),"#b74940")
        obstacles.append([x+2,y,z])
    a,b=route[:2]
    yaw=math.atan2(-(b[0]-a[0]),-(b[2]-a[2]))
    return s,{"name":"Rodovia dos Imigrantes - SP",
        "spawn":{"position":[a[0],a[1]+.9,a[2]],"yawRad":yaw},
        "route":route,"obstacles":obstacles,
        "locationInspired":True,"geographicallyExact":False}
