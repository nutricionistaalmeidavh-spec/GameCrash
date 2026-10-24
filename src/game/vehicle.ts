import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {VehicleSpec} from './rules';
import {wheelLayout} from './driving.ts';
import type {VehicleDynamics} from './driving';
import type {VehicleStructure,PhysicalFragment} from './structure';

export interface VehicleVisual {
  root:THREE.Group;
  wheels:THREE.Group[];
  panels:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[];
  bodyLength:number;
  debrisRoot:THREE.Group;
  setStructure(structure:VehicleStructure):void;
  updatePhysics(driving:VehicleDynamics):void;
  addDamageMeshes(asset:THREE.Group):void;
}
interface SkinBinding {mesh:THREE.Mesh;rest:Float32Array;indices:Uint8Array;weights:Float32Array;toLocal:THREE.Matrix4;active:boolean}
function shell(parent:THREE.Group,name:string,profiles:Array<[number,number,number,number]>,mat:THREE.MeshStandardMaterial){
  const points:number[]=[],indices:number[]=[];
  for(const [z,width,low,high] of profiles)points.push(-width,low,z,width,low,z,width,high,z,-width,high,z);
  for(let i=0;i<profiles.length-1;i++)for(let j=0;j<4;j++){
    const a=i*4+j,b=i*4+(j+1)%4,c=b+4,d=a+4;indices.push(a,b,c,a,c,d);
  }
  const end=(profiles.length-1)*4;
  indices.push(0,2,1,0,3,2,end,end+1,end+2,end,end+2,end+3);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,mat);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
const material=(color:number,roughness=0.38,metalness=0.18)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function box(parent:THREE.Object3D,name:string,size:[number,number,number],at:[number,number,number],mat:THREE.MeshStandardMaterial,segmented=false){
  const geo=new THREE.BoxGeometry(size[0],size[1],size[2],segmented?8:1,segmented?3:1,segmented?10:1);
  const mesh=new THREE.Mesh(geo,mat);
  mesh.position.set(...at);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
export function createVehicle(spec:VehicleSpec):VehicleVisual{
  const root=new THREE.Group();
  const [w,h,l]=spec.size;
  const paint=material(spec.color,0.28,0.33),paintLight=material(spec.color,0.32,0.22);
  const black=material(0x121821,0.83,0.04),glass=material(0x20394d,0.1,0.3),chrome=material(0xc4d7df,0.21,0.7);
  const taillight=material(0xff3847,0.16),headlight=material(0xf2faff,0.18);
  const panels:VehicleVisual['panels']=[];
  // The vehicle's +Z axis is its front; models are generated locally.
  panels.push(shell(root,'body',[
    [-l*.5,w*.40,-h*.40,-h*.10],[-l*.42,w*.49,-h*.45,h*.06],
    [-l*.15,w*.50,-h*.45,h*.08],[l*.18,w*.50,-h*.45,h*.08],
    [l*.41,w*.47,-h*.42,-h*.01],[l*.5,w*.40,-h*.35,-h*.15]
  ],paint));
  panels.push(box(root,'hood',[w*.90,h*.06,l*.25],[0,h*.045,l*.32],paintLight,true));
  const roofLength=spec.id==='suv'?l*.51:l*.43;
  const roof=shell(root,'cabin',[
    [-roofLength*.60,w*.43,h*.06,h*.10],[-roofLength*.30,w*.37,h*.06,h*.59],
    [roofLength*.23,w*.36,h*.06,h*.59],[roofLength*.65,w*.43,h*.06,h*.09]
  ],glass);
  panels.push(roof);
  box(root,'roof',[w*.74,h*.06,roofLength*.54],[0,h*.60,-roofLength*.035],paint);
  for(const side of [-1,1]){
    box(root,'side-skirt',[.08,.24,l*.72],[side*w*.48,-h*.29,0],black);
    box(root,'door-line',[.025,.017,roofLength*.79],[side*w*.501,-h*.04,0],chrome);
    box(root,'mirror',[.20,.12,.24],[side*w*.53,h*.37,l*.09],black);
    box(root,'window-pillar',[.06,h*.53,.08],[side*w*.375,h*.32,-.15],paint);
    box(root,'headlamp',[w*.20,.14,.075],[side*w*.35,-h*.11,l*.505],headlight);
    box(root,'brake-lamp',[w*.21,.12,.075],[side*w*.35,-h*.1,-l*.505],taillight);
  }
  box(root,'front-grille',[w*.46,.20,.08],[0,-h*.29,l*.503],black);
  box(root,'rear-bumper',[w*.77,.16,.10],[0,-h*.34,-l*.51],black);
  const wheels:THREE.Group[]=[];
  const tire=material(0x0b1016,.98,.0);
  const alloy=material(0xb8c0ca,0.31,.69);
  const layout=wheelLayout(spec),wheelRadius=layout.radius;
  for(const side of [-1,1])for(const z of [-layout.axleZ,layout.axleZ]){
    const pivot=new THREE.Group();pivot.position.set(side*layout.halfTrack,layout.y,z);pivot.rotation.order='YXZ';
    const rubber=new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius,wheelRadius,.24,24),tire);
    rubber.rotation.z=Math.PI/2;rubber.castShadow=true;pivot.add(rubber);
    const spokes:THREE.BufferGeometry[]=[];
    for(const sign of [-1,1]){
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius*.61,wheelRadius*.61,.011,12),alloy);
      cap.rotation.z=Math.PI/2;cap.position.x=sign*.119;pivot.add(cap);
      for(let j=0;j<5;j++){
        const spoke=new THREE.BoxGeometry(.015,.055,wheelRadius*1.05);
        spoke.rotateX(j*Math.PI/5);spoke.translate(sign*.127,0,0);spokes.push(spoke);
      }
    }
    pivot.add(new THREE.Mesh(mergeGeometries(spokes),chrome));spokes.forEach(g=>g.dispose());
    root.add(pivot);wheels.push(pivot);
  }
  let structure:VehicleStructure|undefined;
  const bindings:SkinBinding[]=[],debrisRoot=new THREE.Group(),released=new Map<string,{group:THREE.Group;fragment:PhysicalFragment}>();
  const detachableParts=[
    {id:'hood',z:l*.31,match:/^hood/},
    {id:'front-bumper',z:l*.49,match:/^(front.grille|headlamp|front_light|license_plate_front|bumper)/},
    {id:'rear-bumper',z:-l*.49,match:/^(rear.bumper|brake.lamp|rear_light|license_plate_rear|bumper)/}
  ];
  const visible=(mesh:THREE.Object3D)=>{let p:THREE.Object3D|null=mesh;while(p){if(!p.visible)return false;p=p.parent}return true};
  function remember(mesh:THREE.Mesh){
    if(!structure||bindings.some(b=>b.mesh===mesh))return;
    root.updateMatrixWorld(true);
    const original=mesh.geometry;
    mesh.geometry=original.index?original.toNonIndexed():original.clone();original.dispose();
    const toRoot=new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
    const p=mesh.geometry.getAttribute('position'),rest=new Float32Array(p.count*3),indices=new Uint8Array(p.count*4),weights=new Float32Array(p.count*4),v=new THREE.Vector3();
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i).applyMatrix4(toRoot);rest.set([v.x,v.y,v.z],i*3);
      const nearest=structure.nodes.map((n,index)=>({index,d:(n.rest.x-v.x)**2+(n.rest.y-v.y)**2+(n.rest.z-v.z)**2})).sort((a,b)=>a.d-b.d).slice(0,4);
      const sum=nearest.reduce((s,n)=>s+1/(.0001+n.d*n.d),0);
      nearest.forEach((n,j)=>{indices[i*4+j]=n.index;weights[i*4+j]=(1/(.0001+n.d*n.d))/sum});
    }
    bindings.push({mesh,rest,indices,weights,toLocal:toRoot.clone().invert(),active:true});
  }
  function followFragment(id:string,fragment:PhysicalFragment,objects:THREE.Object3D[]){
    if(released.has(id))return;
    const group=new THREE.Group(),p=fragment.body.translation(),q=fragment.body.rotation();
    group.position.set(p.x,p.y,p.z);group.quaternion.set(q.x,q.y,q.z,q.w);debrisRoot.add(group);group.updateMatrixWorld(true);
    root.updateMatrixWorld(true);
    for(const obj of objects){group.attach(obj);for(const b of bindings)if(b.mesh===obj)b.active=false}
    released.set(id,{group,fragment});
  }
  return {
    root,wheels,panels,bodyLength:l,debrisRoot,
    setStructure(value){
      structure=value;
      for(const child of root.children)if(!wheels.includes(child as THREE.Group))child.traverse(obj=>{if(obj instanceof THREE.Mesh)remember(obj)});
    },
    updatePhysics(driving){
      if(!structure)return;
      const controller=driving.controller;
      for(let i=0;i<4;i++){
        const fragment=driving.wheelFragments[i];
        if(fragment){followFragment('wheel-'+i,fragment,[wheels[i]]);continue}
        const point=controller.wheelChassisConnectionPointCs(i)!;
        wheels[i].position.set(point.x,point.y-(controller.wheelSuspensionLength(i)??layout.rest),point.z);
        wheels[i].rotation.set(controller.wheelRotation(i)??0,controller.wheelSteering(i)??0,0,'YXZ');
      }
      const offsets=structure.nodes.map(n=>{const p=structure!.localPosition(n);return {x:p.x-n.rest.x,y:p.y-n.rest.y,z:p.z-n.rest.z}});
      const point=new THREE.Vector3();
      for(const binding of bindings){
        if(!binding.active||!visible(binding.mesh))continue;
        const {mesh,rest,indices,weights,toLocal}=binding,pos=mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const unsupported=new Uint8Array(pos.count);
        for(let i=0;i<pos.count;i++){
          let dx=0,dy=0,dz=0,total=0;
          for(let j=0;j<4;j++){
            const n=indices[i*4+j],w=weights[i*4+j];if(structure.nodes[n].detached)continue;
            dx+=offsets[n].x*w;dy+=offsets[n].y*w;dz+=offsets[n].z*w;total+=w;
          }
          point.set(rest[i*3]+dx/Math.max(.001,total),rest[i*3+1]+dy/Math.max(.001,total),rest[i*3+2]+dz/Math.max(.001,total)).applyMatrix4(toLocal);
          pos.setXYZ(i,point.x,point.y,point.z);
          unsupported[i]=total<.02?1:0;
        }
        // Non-indexed faces can tear without pulling the rest of a panel into long spikes.
        for(let i=0;i<pos.count;i+=3){
          let torn=Boolean(unsupported[i]||unsupported[i+1]||unsupported[i+2]);
          if(!torn&&structure.brokenBeams>0)for(let j=1;j<3;j++){
            const current=Math.hypot(pos.getX(i)-pos.getX(i+j),pos.getY(i)-pos.getY(i+j),pos.getZ(i)-pos.getZ(i+j));
            const original=Math.hypot(rest[i*3]-rest[(i+j)*3],rest[i*3+1]-rest[(i+j)*3+1],rest[i*3+2]-rest[(i+j)*3+2]);
            if(current>original*2+.3)torn=true;
          }
          if(torn)for(let j=1;j<3;j++)pos.setXYZ(i+j,pos.getX(i),pos.getY(i),pos.getZ(i));
        }
        pos.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();mesh.geometry.computeBoundingBox();
      }
      root.updateMatrixWorld(true);
      if(structure.brokenBeams>0)for(const part of detachableParts){
        const fragment=structure.fragments.find(f=>f.id===part.id);
        if(released.has(part.id)||!fragment)continue;
        const selected=bindings.filter(b=>b.active&&visible(b.mesh)&&part.match.test(b.mesh.name)&&Math.sign(b.rest[2])===Math.sign(part.z));
        if(!selected.length)continue;
        followFragment(part.id,fragment,selected.map(b=>b.mesh));
      }
      for(const {group,fragment} of released.values()){
        const p=fragment.body.translation(),q=fragment.body.rotation();group.position.set(p.x,p.y,p.z);group.quaternion.set(q.x,q.y,q.z,q.w);
      }
    },
    addDamageMeshes(asset){
      asset.traverse(obj=>{
        if(obj instanceof THREE.Mesh&&!obj.name.startsWith('wheel_')){
          remember(obj);
          // A model that arrives after a crash must not restore a detached panel.
          const binding=bindings.find(b=>b.mesh===obj);
          if(binding)for(const part of detachableParts)if(structure?.fragments.some(f=>f.id===part.id)&&part.match.test(obj.name)&&Math.sign(binding.rest[2])===Math.sign(part.z))obj.visible=false;
        }
      });
    }
  };
}
