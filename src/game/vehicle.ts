import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {VehicleSpec} from './rules';
import {clamp} from './rules';
import {wheelLayout} from './driving';
import type {DynamicRayCastVehicleController} from '@dimforge/rapier3d-compat';

export interface VehicleVisual {
  root:THREE.Group;
  wheels:THREE.Group[];
  panels:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[];
  bodyLength:number;
  spin(amount:number):void;
  updateWheels(controller:DynamicRayCastVehicleController):void;
  addDamageMeshes(asset:THREE.Group):void;
  deform(damage:number):void;
}
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
  const restPositions=new Map<THREE.Mesh,Float32Array>();
  function remember(mesh:THREE.Mesh){restPositions.set(mesh,new Float32Array(mesh.geometry.getAttribute('position').array))}
  panels.forEach(remember);
  return {
    root,wheels,panels,bodyLength:l,
    spin(distance:number){for(const wheel of wheels)wheel.rotation.x+=distance/wheelRadius},
    updateWheels(controller){
      for(let i=0;i<4;i++){
        wheels[i].position.y=layout.y+layout.rest-(controller.wheelSuspensionLength(i)??layout.rest);
        wheels[i].rotation.set(controller.wheelRotation(i)??0,controller.wheelSteering(i)??0,0,'YXZ');
      }
    },
    addDamageMeshes(asset){
      asset.traverse(obj=>{
        if(obj instanceof THREE.Mesh&&!obj.name.startsWith('wheel_')){
          // Each panel owns its mutable vertex data.
          const original=obj.geometry;obj.geometry=original.clone();original.dispose();remember(obj);
        }
      });
    },
    deform(damage:number){
      const crush=clamp(damage/100,0,1);
      root.updateMatrixWorld(true);
      const toRoot=new THREE.Matrix4(),toLocal=new THREE.Matrix4(),point=new THREE.Vector3();
      for(const [mesh,original] of restPositions){
        toRoot.copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);toLocal.copy(toRoot).invert();
        const pos=mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        for(let i=0;i<pos.count;i++){
          point.set(original[i*3],original[i*3+1],original[i*3+2]).applyMatrix4(toRoot);
          const factor=clamp((point.z-l*.08)/(l*.42),0,1);
          const wrinkle=Math.sin(i*4.77+mesh.position.z*3.51)*.06;
          point.x+=wrinkle*crush*factor;point.y-=crush*.16*factor;point.z-=crush*.95*factor;
          point.applyMatrix4(toLocal);pos.setXYZ(i,point.x,point.y,point.z);
        }
        pos.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
      }
      if(crush>.67){wheels[1].position.x-=.29*crush;wheels[3].position.x+=.3*crush;wheels[1].rotation.z=.35*crush;}
    }
  };
}
