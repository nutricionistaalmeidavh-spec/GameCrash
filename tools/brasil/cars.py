"""Ten original stylized Brazilian car meshes; not manufacturer CAD."""
import trimesh
from .geometry import box,tube

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
    box(s,"body",(0,.75,0),(w,.43,l*.93),color)
    box(s,"hood",(0,.97,-l*.32),(w*.89,.13,l*.27),color)
    box(s,"front_grille",(0,.65,-l*.474),(w*.62,.13,.024),"#202b31")
    for sign in (-1,1):
        for z in (-wb/2,wb/2):
            tube(s,"wheel_tire",(sign*w*.48,.34,z),.34,.23,"#141718","X")
            tube(s,"wheel_rim",(sign*w*.55,.34,z),.18,.027,"#c0c5cb","X")
        box(s,"front_light",(sign*w*.31,.83,-l*.473),(w*.17,.13,.030),"#f6f3da")
        box(s,"rear_light",(sign*w*.33,.83,l*.474),(w*.16,.13,.030),"#b2222a")
        box(s,"mirror",(sign*w*.53,1.08,-l*.12),(.13,.13,.20),"#343d43")
    if style=="pickup":
        box(s,"cab",(0,1.16,-l*.14),(w*.83,h-.83,l*.43),color)
        box(s,"windshield",(0,1.34,-l*.36),(w*.70,.30,.03),"#5a8194")
        box(s,"bed_floor",(0,.98,l*.29),(w*.78,.07,l*.34),"#31383d")
        for sign in (-1,1):
            box(s,"bed_side",(sign*w*.44,1.12,l*.27),(.07,.34,l*.35),color)
        box(s,"tailgate",(0,1.13,l*.45),(w*.87,.35,.08),color)
    else:
        cab=l*(.51 if style=="boxy" else .45)
        box(s,"roof",(0,1.06+(h-1.04)/2,.12),(w*.80,h-1.04,cab),color)
        box(s,"windshield",(0,1.36,.13-cab/2),(w*.73,.32,.035),"#577f94")
        box(s,"rear_window",(0,1.34,.13+cab/2),(w*.73,.30,.035),"#4c6573")
        for sign in (-1,1):
            box(s,"side_window",(sign*w*.42,1.36,.12),(.03,.29,cab*.80),"#477488")
    box(s,"license_plate_front",(0,.53,-l*.478),(.37,.12,.02),"#f0efed")
    box(s,"license_plate_rear",(0,.53,l*.478),(.37,.12,.02),"#f0efed")
    s.export(folder/(slug+".glb"))
    return slug,{"name":name,"file":"assets/brazil/cars/"+slug+".glb","massKg":mass,
        "widthMeters":w,"lengthMeters":l,"heightMeters":h,"wheelbaseMeters":wb,
        "approximateGameplayValues":True,"kind":style,
        "collider":{"halfExtents":[round(w*.47,3),round(h*.43,3),round(l*.44,3)],
        "center":[0,round(h*.53,3),0]}}
