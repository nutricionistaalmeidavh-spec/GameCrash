"""Ten original stylized Brazilian car meshes; not manufacturer CAD."""
import trimesh
from .geometry import box,tube,add

def loft(scene,name,rows,color,top_ratio=.95):
    """A shaped body/cabin from cross sections, instead of stacked rectangular boxes."""
    vertices=[]
    faces=[]
    for z,width,low,high in rows:
        vertices.extend([(-width,low,z),(width,low,z),
                         (width*top_ratio,high,z),(-width*top_ratio,high,z)])
    for i in range(len(rows)-1):
        for j in range(4):
            a=i*4+j;b=i*4+(j+1)%4;c=b+4;d=a+4
            faces.extend([(a,b,c),(a,c,d)])
    end=(len(rows)-1)*4
    faces.extend([(0,2,1),(0,3,2),(end,end+1,end+2),(end,end+2,end+3)])
    mesh=trimesh.Trimesh(vertices=vertices,faces=faces,process=False)
    mesh.fix_normals()
    add(scene,mesh,name,color)

SPECS=[
("gol","Volkswagen Gol",1.66,3.90,1.47,2.47,1010,"#e7e7e7","hatch"),
("strada","Fiat Strada",1.73,4.47,1.62,2.74,1240,"#b23e41","pickup"),
("palio","Fiat Palio",1.64,3.82,1.44,2.37,1000,"#c9cbcc","hatch"),
("onix","Chevrolet Onix",1.74,4.16,1.47,2.55,1100,"#3278af","hatch"),
("uno","Fiat Uno",1.64,3.77,1.48,2.38,940,"#e0d7bd","boxy"),
("hb20","Hyundai HB20",1.72,4.01,1.47,2.53,1070,"#d9dde0","hatch"),
("fiesta","Ford Fiesta",1.72,3.97,1.46,2.49,1120,"#40516c","hatch"),
("ka","Ford Ka",1.70,3.89,1.53,2.49,1030,"#cb9e39","hatch"),
("fox","Volkswagen Fox",1.66,3.82,1.54,2.47,1040,"#c7c9c5","boxy"),
("celta","Chevrolet Celta",1.63,3.79,1.43,2.44,920,"#a74239","hatch")]

def build_car(row,folder):
    slug,name,w,l,h,wb,mass,color,style=row
    s=trimesh.Scene()
    box(s,"chassis",(0,.53,0),(w*.87,.32,l*.88),"#25282d")
    loft(s,"body",[
        (-l*.48,w*.40,.49,.78),(-l*.40,w*.48,.46,.95),
        (-l*.18,w*.50,.45,1.01),(l*.20,w*.50,.45,1.00),
        (l*.40,w*.48,.48,.94),(l*.48,w*.41,.53,.82)],color)
    loft(s,"hood",[(-l*.42,w*.44,.94,.97),(-l*.18,w*.46,.98,1.03)],color)
    box(s,"front_grille",(0,.65,-l*.474),(w*.62,.13,.024),"#202b31")
    for sign in (-1,1):
        for z in (-wb/2,wb/2):
            tube(s,"wheel_tire",(sign*w*.48,.34,z),.34,.23,"#141718","X")
            tube(s,"wheel_rim",(sign*w*.55,.34,z),.18,.027,"#c0c5cb","X")
        box(s,"front_light",(sign*w*.31,.83,-l*.473),(w*.17,.13,.030),"#f6f3da")
        box(s,"rear_light",(sign*w*.33,.83,l*.474),(w*.16,.13,.030),"#b2222a")
        box(s,"mirror",(sign*w*.53,1.08,-l*.12),(.13,.13,.20),"#343d43")
        box(s,"door_handle",(sign*w*.49,1.01,l*.04),(.025,.04,.15),"#c0c5cb")
        box(s,"lower_sill",(sign*w*.49,.48,.05),(.045,.09,l*.64),"#25282d")
    if style=="pickup":
        loft(s,"cab_glass",[(-l*.36,w*.43,1.00,1.03),(-l*.25,w*.39,1.00,h-.06),
                            (-l*.01,w*.39,1.00,h-.06),(l*.02,w*.43,1.00,1.05)],"#28434f",.92)
        box(s,"roof",(0,h-.04,-l*.13),(w*.73,.065,l*.25),color)
        box(s,"bed_floor",(0,.98,l*.29),(w*.78,.07,l*.34),"#31383d")
        for sign in (-1,1):
            box(s,"bed_side",(sign*w*.44,1.12,l*.27),(.07,.34,l*.35),color)
        box(s,"tailgate",(0,1.13,l*.45),(w*.87,.35,.08),color)
    else:
        cab=l*(.51 if style=="boxy" else .45)
        loft(s,"cab_glass",[(.12-cab*.60,w*.43,1.00,1.04),
                             (.12-cab*.30,w*.39,1.00,h-.06),
                             (.12+cab*.31,w*.39,1.00,h-.06),
                             (.12+cab*.56,w*.43,1.00,1.06)],"#28434f",.92)
        box(s,"roof",(0,h-.04,.12),(w*.73,.065,cab*.62),color)
        for sign in (-1,1):
            box(s,"window_pillar",(sign*w*.373,(h+1.01)/2,.12),(.055,h-1.01,.065),color)
    for z in (-l*.485,l*.485):
        box(s,"bumper",(0,.56,z),(w*.83,.12,.065),"#343d43")
    box(s,"license_plate_front",(0,.53,-l*.478),(.37,.12,.02),"#f0efed")
    box(s,"license_plate_rear",(0,.53,l*.478),(.37,.12,.02),"#f0efed")
    s.export(folder/(slug+".glb"))
    return slug,{"name":name,"file":"assets/brazil/cars/"+slug+".glb","massKg":mass,
        "widthMeters":w,"lengthMeters":l,"heightMeters":h,"wheelbaseMeters":wb,
        "approximateGameplayValues":True,"kind":style,
        "collider":{"halfExtents":[round(w*.47,3),round(h*.43,3),round(l*.44,3)],
        "center":[0,round(h*.53,3),0]}}
