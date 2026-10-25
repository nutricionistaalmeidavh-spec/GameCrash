"""Blender 4.5 LTS: prepare the normalized Concept GLB for physical destruction.
Run: blender -b --python tools/concept/author.py -- input.glb output.blend output.glb
All dimensions below are metres. Source materials and attribution remain intact.
"""
import bpy, bmesh, math, sys
from mathutils import Vector, Matrix
source, blend_path, glb_path = sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
bpy.context.view_layer.update()

def split_faces(obj, name, predicate):
    chosen=[p.index for p in obj.data.polygons if predicate(obj.matrix_world @ p.center)]
    if not chosen: return None
    clone=obj.copy(); clone.data=obj.data.copy(); clone.name=name
    bpy.context.collection.objects.link(clone)
    for target, keep in [(clone,True),(obj,False)]:
        bm=bmesh.new(); bm.from_mesh(target.data); bm.faces.ensure_lookup_table()
        selected=set(chosen)
        bmesh.ops.delete(bm,geom=[f for f in bm.faces if (f.index in selected)!=keep],context='FACES')
        bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
        bm.to_mesh(target.data);bm.free();target.data.update()
    return clone

# glTF +Z forward becomes Blender -Y. Split actual bumper faces out of shared trim.
bumpers={'front-bumper':[], 'rear-bumper':[]}
for name in ['BodyPanelsColor2','BodyRearPanelsColor1']:
    obj=bpy.data.objects.get(name)
    if not obj: continue
    for key,sign in [('front-bumper',-1),('rear-bumper',1)]:
        piece=split_faces(obj,'Body'+('Front' if sign<0 else 'Rear')+'Bumper_'+name,
            lambda p,s=sign: p.y*s>1.78 and p.z<.80)
        if piece: bumpers[key].append(piece)

# Real inner wheel arches: upper half-shell, open below to clear suspension travel.
liner_mat=bpy.data.materials.new('Wheelwell rubberized steel');liner_mat.diffuse_color=(.025,.03,.035,1)
liner_mat.use_nodes=True;liner_mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.88
for i in range(4):
    wheel=bpy.data.objects.get('concept-wheel-'+str(i)); c=wheel.matrix_world.translation
    verts=[];faces=[]
    for step in range(25):
        a=math.pi*step/24
        for dx in [-.17,.17]: verts.append((c.x+dx,c.y+.50*math.cos(a),c.z+.50*math.sin(a)))
    for step in range(24): faces.append((step*2,step*2+1,step*2+3,step*2+2))
    mesh=bpy.data.meshes.new('WheelwellGeometry');mesh.from_pydata(verts,[],faces);mesh.materials.append(liner_mat)
    arch=bpy.data.objects.new('BodyWheelwell'+str(i),mesh);bpy.context.collection.objects.link(arch)

# Add fold support only on long sheet edges; leave interior, glass and wheels alone.
outer=[]
for obj in list(bpy.data.objects):
    if obj.type!='MESH': continue
    name=obj.name
    if name.startswith(('BodyHood','BodyDoor','BodyRoofPanel','BodyPanels','BodyRearPanels','BodyFrontBumper','BodyRearBumper','BodyWheelwell')) and not any(x in name for x in ['Window','Gasket','Mirror','Handle','Interior','grill','Under']):
        outer.append(obj)
        bm=bmesh.new();bm.from_mesh(obj.data)
        for _ in range(3):
            edges=[e for e in bm.edges if (obj.matrix_world.to_3x3() @ (e.verts[0].co-e.verts[1].co)).length>.18]
            if not edges: break
            bmesh.ops.subdivide_edges(bm,edges=edges,cuts=1,use_grid_fill=True)
        bm.to_mesh(obj.data);bm.free()
        mod=obj.modifiers.new('Exposed sheet thickness 6 mm','SOLIDIFY');mod.thickness=.006;mod.offset=-1;mod.use_even_offset=False
        obj['sheetThicknessM']=.006
    elif any(x in name for x in ['Windshield','Rearwindow','DoorLWindow','DoorRWindow']) and not any(x in name for x in ['Gasket','Wiper']):
        mod=obj.modifiers.new('Laminated glass edge 3 mm','SOLIDIFY');mod.thickness=.003;mod.offset=-1
        obj['sheetThicknessM']=.003

# Assembly origins are explicit pivots. Parenting keeps authored world-space geometry.
def assembly(part_id, objects):
    objects=[o for o in objects if o]
    if not objects: raise RuntimeError('Missing crash assembly '+part_id)
    group=bpy.data.objects.new('part-'+part_id,None);bpy.context.collection.objects.link(group)
    coords=[o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
    pivot=sum(coords,Vector())/len(coords)
    if part_id.startswith('door'): pivot.y=min(p.y for p in coords) # front hinge edge
    group.location=pivot;group['crashPart']=part_id
    bpy.context.view_layer.update()
    for obj in objects:
        world=obj.matrix_world.copy();obj.parent=group;obj.matrix_world=world
    return group

assembly('hood',[bpy.data.objects.get('BodyHood')])
assembly('door-left',[bpy.data.objects.get('BodyDoorRColor1')]) # game left is negative X
assembly('door-right',[bpy.data.objects.get('BodyDoorLColor1')])
for part,objects in bumpers.items(): assembly(part,objects)
for part,name in [('glass-front','BodyWindshield'),('glass-rear','BodyRearwindow'),('glass-left','BodyDoorRWindow'),('glass-right','BodyDoorLWindow')]:
    obj=bpy.data.objects.get(name)
    if obj:
        parent=obj.parent; group=assembly(part,[obj])
        if parent and part in ['glass-left','glass-right']:
            world=group.matrix_world.copy();group.parent=parent;group.matrix_world=world
# Keep exterior normals smooth; structural creases remain encoded by the source mesh.
for obj in outer:
    for polygon in obj.data.polygons: polygon.use_smooth=True
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=blend_path,compress=True)
bpy.ops.export_scene.gltf(filepath=glb_path,export_format='GLB',export_extras=True,export_apply=True,export_materials='EXPORT',export_yup=True)
print('CRASH_ASSET_COMPLETE',len(outer),'thickened panels')
