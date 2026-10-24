import * as THREE from 'three';
import type {VehicleSpec} from './rules';
import {clamp} from './rules';

export interface VehicleVisual {
  root:THREE.Group;
  wheels:THREE.Group[];
  panels:THREE.Mesh<THREE.BoxGeometry,THREE.MeshStandardMaterial>[];
  bodyLength:number;
  spin(amount:number):void;
  deform(damage:number):void;
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
  // The vehicle's +Z axis is its front; models are generated locally (no paid assets).
  panels.push(box(root,'body',[w,h*.48,l],[0,-h*.23,0],paint,true));
  panels.push(box(root,'hood',[w*.93,h*.12,l*.31],[0,h*.05,l*.34],paintLight,true));
  panels.push(box(root,'rear-deck',[w*.92,h*.12,l*.23],[0,h*.05,-l*.36],paintLight,true));
  const roofLength=spec.id==='suv'?l*.51:l*.43;
  const roof=box(root,'cabin',[w*.76,h*.59,roofLength],[0,h*.29,spec.id==='hatch'?-0.32:-0.18],glass,true);
  panels.push(roof);
  box(root,'roof',[w*.79,h*.1,roofLength*.76],[0,h*.63,-0.22],paint);
  for(const side of [-1,1]){
    box(root,'side-skirt',[.08,.24,l*.72],[side*w*.48,-h*.29,0],black);
    box(root,'door-line',[.025,.017,roofLength*.79],[side*w*.501,-h*.04,0],chrome);
    box(root,'mirror',[.20,.12,.24],[side*w*.53,h*.37,l*.09],black);
    box(root,'headlamp',[w*.20,.14,.075],[side*w*.35,-h*.11,l*.505],headlight);
    box(root,'brake-lamp',[w*.21,.12,.075],[side*w*.35,-h*.1,-l*.505],taillight);
  }
  box(root,'front-grille',[w*.46,.20,.08],[0,-h*.29,l*.503],black);
  box(root,'rear-bumper',[w*.77,.16,.10],[0,-h*.34,-l*.51],black);
  const wheels:THREE.Group[]=[];
  const tire=material(0x0b1016,.98,.0);
  const alloy=material(0xb8c0ca,0.31,.69);
  const wheelRadius=spec.id==='suv'?.41:.36;
  for(const side of [-1,1])for(const z of [-l*.32,l*.31]){
    const pivot=new THREE.Group();pivot.position.set(side*(w*.51),-h*.39,z);
    const rubber=new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius,wheelRadius,.22,16),tire);
    rubber.rotation.z=Math.PI/2;rubber.castShadow=true;pivot.add(rubber);
    for(const sign of [-1,1]){
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius*.61,wheelRadius*.61,.011,12),alloy);
      cap.rotation.z=Math.PI/2;cap.position.x=sign*.119;pivot.add(cap);
    }
    root.add(pivot);wheels.push(pivot);
  }
  return {
    root,wheels,panels,bodyLength:l,
    spin(distance:number){for(const wheel of wheels)wheel.rotation.x+=distance/wheelRadius},
    deform(damage:number){
      const crush=clamp(damage/100,0,1);
      for(const mesh of panels){
        // Real vertex deformation of the mesh, with stronger displacement near the nose.
        const pos=mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        for(let i=0;i<pos.count;i++){
          const globalZ=mesh.position.z+pos.getZ(i);
          const factor=clamp((globalZ+l*.05)/(l*.52),0,1);
          const wrinkle=Math.sin(i*4.77+mesh.position.z*3.51)*.06;
          pos.setXYZ(i,pos.getX(i)+(wrinkle*crush*factor),pos.getY(i)-crush*.16*factor,pos.getZ(i)-crush*1.3*factor);
        }
        pos.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
      }
      if(crush>.67){wheels[1].position.x-=.29*crush;wheels[3].position.x+=.3*crush;wheels[1].rotation.z=.35*crush;}
    }
  };
}
