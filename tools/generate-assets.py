"""Procedural CC0-like stylized Brazilian crash-simulation GLB assets. No Godot or proprietary models."""
from pathlib import Path
import json, math, random
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

BASE = Path(__file__).resolve().parents[1]
OUT = BASE / 'public' / 'assets'
(OUT/'cars').mkdir(parents=True, exist_ok=True)
(OUT/'maps').mkdir(parents=True, exist_ok=True)

COLORS = {
 'white':'#eeeff0','silver':'#b7bdc5','red':'#b12d39','blue':'#356394',
 'dark':'#202228','glass':'#24475b','tire':'#151719','hub':'#aeb1b9',
 'lights':'#eaf2ef','brake':'#b90f1a','asphalt':'#48494b','lane':'#ece8dd',
 'grass':'#668451','forest':'#3e733a','trunk':'#695642',
 'concrete':'#b3b7bc','purple':'#7635c9','soil':'#695c52','sky':'#c6dbe0'
}
MAT = {}
for key, value in COLORS.items():
    rgb = [int(value[i:i+2], 16)/255 for i in (1,3,5)]
    MAT[key] = PBRMaterial(baseColorFactor=(*rgb, 1.0),
        metallicFactor=.18 if key in ('silver','hub','blue') else 0,
        roughnessFactor=.35 if key == 'glass' else .85, doubleSided=True)

def put(s, mesh, name, color):
    mesh.visual = TextureVisuals(material=MAT[color])
    s.add_geometry(mesh, geom_name=name, node_name=name)
def box(s, name, center, size, color, yaw=0):
    mesh=trimesh.creation.box(extents=size)
    if yaw: mesh.apply_transform(trimesh.transformations.rotation_matrix(yaw,[0,1,0]))
    mesh.apply_translation(center)
    put(s,mesh,name,color)
def sphere(s,name,center,r,color,scale=(1,1,1)):
    m=trimesh.creation.icosphere(subdivisions=1,radius=r)
    m.apply_scale(scale);m.apply_translation(center);put(s,m,name,color)
def wheel(s,name,center,radius):
    m=trimesh.creation.cylinder(radius=radius,height=.19,sections=14)
    m.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,[0,1,0]))
    m.apply_translation(center);put(s,m,name,'tire')
    m=trimesh.creation.cylinder(radius=radius*.50,height=.205,sections=12)
    m.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,[0,1,0]))
    m.apply_translation(center);put(s,m,name+'_hub','hub')

SPECS = {
 'gol':('Volkswagen Gol',4.0,1.7,1.45,1040,'hatch','white'),
 'strada':('Fiat Strada',4.45,1.74,1.63,1210,'pickup','silver'),
 'palio':('Fiat Palio',3.85,1.66,1.44,990,'hatch','blue'),
 'onix':('Chevrolet Onix',4.16,1.73,1.48,1110,'hatch','white'),
 'uno':('Fiat Uno',3.77,1.63,1.48,910,'square','red'),
 'hb20':('Hyundai HB20',4.01,1.72,1.47,1080,'hatch','silver'),
 'fiesta':('Ford Fiesta',3.97,1.72,1.47,1110,'hatch','blue'),
 'ka':('Ford Ka',3.88,1.70,1.52,1020,'hatch','white'),
 'fox':('Volkswagen Fox',3.83,1.66,1.56,1050,'square','red'),
 'celta':('Chevrolet Celta',3.79,1.63,1.42,900,'hatch','silver')
}

def vehicle(key, data):
    label,L,W,H,mass,kind,color = data
    s=trimesh.Scene()
    tire=.30
    box(s,'BODY_main',(0,.62,0),(W,.58,L),color)
    box(s,'BODY_lower',(0,.34,0),(W-.09,.24,L-.10),'dark')
    if kind=='pickup':
        box(s,'BODY_cab',(0,1.13,-.58),(W-.17,.80,1.65),color)
        box(s,'WINDOW_front',(0,1.18,-1.41),(W-.4,.53,.04),'glass')
        box(s,'WINDOW_rear',(0,1.18,.25),(W-.39,.55,.05),'glass')
        box(s,'BODY_bed',(0,.83,1.05),(W-.12,.34,1.65),color)
        box(s,'BODY_bed_floor',(0,.71,1.07),(W-.25,.035,1.55),'dark')
    else:
        roof_len=L*(.48 if kind=='square' else .44)
        cabz=0.10 if kind=='square' else .19
        box(s,'BODY_cabin',(0,1.10,cabz),(W-.16,.68,roof_len),color)
        box(s,'WINDOW_front',(0,1.13,cabz-roof_len/2-.02),(W-.39,.44,.04),'glass')
        box(s,'WINDOW_rear',(0,1.13,cabz+roof_len/2+.02),(W-.39,.43,.04),'glass')
    for side in (-1,1):
        for z in (-L*.30,L*.30):
            wheel(s,'WHEEL_'+str(side)+'_'+str(z),(side*(W/2+.018),.33,z),tire)
        box(s,'WINDOW_side_'+str(side),(side*(W/2-.06),1.14,.0),(.04,.35,L*.31),'glass')
        box(s,'LIGHT_front_'+str(side),(side*(W*.33),.71,-L/2-.017),(.27,.19,.04),'lights')
        box(s,'LIGHT_rear_'+str(side),(side*(W*.35),.75,L/2+.017),(.24,.20,.04),'brake')
    box(s,'BODY_bumper_front',(0,.38,-L/2-.05),(W*.82,.19,.11),'dark')
    box(s,'BODY_bumper_rear',(0,.38,L/2+.05),(W*.82,.19,.11),'dark')
    (OUT/'cars'/f'{key}.glb').write_bytes(s.export(file_type='glb'))
    return {'id':key,'name':label,'file':f'cars/{key}.glb','massKg':mass,
        'wheelbaseMeters':round(L*.6,2),'dimensionsMeters':[W,H,L],
        'collider':{'shape':'cuboid','halfExtents':[round(W*.49,3),.60,round(L*.48,3)]},
        'frontAxis':'-Z','stylized':True}

def forest(s, rng, count, length, edge):
    for i in range(count):
        x=rng.choice((-1,1))*rng.uniform(edge,edge+80)
        z=rng.uniform(-length+25,170)
        box(s,f'trunk_{i}',(x,1.9,z),(.5,3.8,.5),'trunk')
        sphere(s,f'foliage_{i}',(x,4.4,z),2.4,'forest',(.9,1.5,.9))

def route_for(which):
    pts=[]
    n=95
    for i in range(n):
        t=i/(n-1)
        z=165-760*t
        if which=='brasilia-eixo-monumental':
            x=0; y=0
        elif which=='imigrantes':
            x=18*math.sin(3.5*math.pi*t) + 8*math.sin(1.2*math.pi*t)
            y=10-35*t
        else:
            x=40*math.sin(5.8*math.pi*t)+11*math.sin(1.5*math.pi*t)
            y=26-60*t
        pts.append([round(x,3),round(y,3),round(z,3)])
    return pts

MAPS={
 'brasilia-eixo-monumental':('Eixo Monumental — Brasília',5,3.65),
 'imigrantes':('Rodovia dos Imigrantes — SP',3,3.65),
 'serra-do-rio-do-rastro':('Serra do Rio do Rastro — SC',2,3.50)
}

def map_scene(slug,label,lanes,lane_width):
    rng=random.Random({'brasilia-eixo-monumental':12,'imigrantes':23,
                       'serra-do-rio-do-rastro':34}[slug])
    s=trimesh.Scene()
    route=route_for(slug)
    width=lanes*lane_width
    height0=-65 if slug=='serra-do-rio-do-rastro' else -45 if slug=='imigrantes' else -.8
    box(s,'TERRAIN_ground',(0,height0-.5,-230),(340,1.0,870),'grass')
    for i in range(len(route)-1):
        a=np.array(route[i]);b=np.array(route[i+1])
        delta=b-a;length=np.linalg.norm(delta[[0,2]])
        yaw=math.atan2(delta[0],delta[2])
        center=(a+b)/2
        box(s,f'COLLIDER_road_{i}',(center[0],center[1]-.13,center[2]),
            (width,.25,length+.40),'asphalt',yaw)
        if i%4==0:
            for lane in range(1,lanes):
                offset=-width/2+lane*lane_width
                local=np.array([offset,0,0])
                c=center+trimesh.transformations.rotation_matrix(yaw,[0,1,0])[:3,:3]@local
                box(s,f'lane_{i}_{lane}',(c[0],center[1]+.01,c[2]),
                    (.11,.025,length*.68),'lane',yaw)
        if i%5==0 and slug!='brasilia-eixo-monumental':
            for side in (-1,1):
                c=center + trimesh.transformations.rotation_matrix(yaw,[0,1,0])[:3,:3]@np.array([side*(width/2+.65),0,0])
                box(s,f'COLLIDER_guardrail_{i}_{side}',(c[0],c[1]+.48,c[2]),
                    (.18,.83,length*5.1),'concrete',yaw)
    if slug=='brasilia-eixo-monumental':
        forest(s,rng,120,760,width/2+14)
        for i in range(18):
            z=140-i*35
            for side in (-1,1):
                x=side*(width/2+50)
                h=8+(i%5)*4
                box(s,f'building_{i}_{side}',(x,h/2,z),(22,h,21),'concrete')
        box(s,'Brasilia_monument',(0,11,-560),(2.8,22,2.8),'white')
    elif slug=='imigrantes':
        forest(s,rng,170,760,width/2+20)
        for i in range(0,len(route)-1,7):
            x,y,z=route[i]
            box(s,f'bridge_pillar_{i}',(x,(y+height0)/2,z),(2.0,y-height0,2.0),'concrete')
    else:
        forest(s,rng,165,760,width/2+40)
        for i in range(0,len(route)-1,9):
            x,y,z=route[i]
            box(s,f'mountain_pillar_{i}',(x,(y+height0)/2,z),(3,y-height0,3),'soil')
    index=28
    a=route[index]
    box(s,'COLLIDER_obstacle_barrier',(a[0],a[1]+.70,a[2]),(width*.60,1.4,.36),'purple')
    b=route[65]
    box(s,'COLLIDER_obstacle_ramp',(b[0],b[1]+.3,b[2]),(2,.6,3.2),'purple')
    (OUT/'maps'/f'{slug}.glb').write_bytes(s.export(file_type='glb'))
    tangent=np.array(route[2])-np.array(route[1])
    yaw=math.atan2(-tangent[0],-tangent[2])+math.pi
    return {'id':slug,'name':label,'file':f'maps/{slug}.glb','lanes':lanes,
        'laneWidthMeters':lane_width,'roadWidthMeters':width,'route':route,
        'spawn':{'position':[route[1][0],route[1][1]+.3,route[1][2]],
                 'yawRad':round(yaw,5)},
        'obstacles':[{'type':'barrier','position':[a[0],a[1]+.7,a[2]]},
                     {'type':'ramp','position':[b[0],b[1]+.3,b[2]]}],
        'stylized':True,'notForNavigation':True}

def main():
    cars={k:vehicle(k,v) for k,v in SPECS.items()}
    maps={k:map_scene(k,*data) for k,data in MAPS.items()}
    manifest={'name':'Brasil Crash — assets brasileiros','version':'1.0.0',
        'units':'meters','vehicleForward':'-Z','cars':cars,'maps':maps,
        'disclaimer':'Modelos e mapas estilizados; parâmetros físicos apenas para gameplay.'}
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
    print('Created',len(cars),'cars',len(maps),'maps')

if __name__=='__main__': main()
