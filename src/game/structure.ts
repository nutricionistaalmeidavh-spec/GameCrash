import concept from './concept.json' with {type:'json'};
import type * as RAPIER from '@dimforge/rapier3d-compat';
import {clamp,type VehicleSpec} from './rules.ts';

type Vec={x:number;y:number;z:number};
type Api=Pick<typeof RAPIER,'RigidBodyDesc'|'ColliderDesc'|'JointData'|'ActiveEvents'>;
export interface StructureNode {rest:Vec;body:RAPIER.RigidBody;anchor:boolean;collider?:RAPIER.Collider;damage:number;detached:boolean}
interface Beam {a:StructureNode;b:StructureNode;initial:number;rest:number;appliedRest:number;stiffness:number;yieldForce:number;joint:RAPIER.ImpulseJoint;broken:boolean;clock:number;surface?:RAPIER.Collider;surfaceLength:number}
export interface PhysicalFragment {id:string;body:RAPIER.RigidBody;halfExtents:Vec}
const length=(v:Vec)=>Math.hypot(v.x,v.y,v.z);
const sub=(a:Vec,b:Vec):Vec=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const zero=()=>({x:0,y:0,z:0});
export function rotate(v:Vec,q:{x:number;y:number;z:number;w:number}):Vec {
  const tx=2*(q.y*v.z-q.z*v.y),ty=2*(q.z*v.x-q.x*v.z),tz=2*(q.x*v.y-q.y*v.x);
  return {x:v.x+q.w*tx+q.y*tz-q.z*ty,y:v.y+q.w*ty+q.z*tx-q.x*tz,z:v.z+q.w*tz+q.x*ty-q.y*tx};
}

/** A bounded, elastoplastic node/beam cage coupled to Rapier's central cabin.
 * Springs exchange real impulses with the cabin; yielding changes their rest lengths.
 * Rupture removes a joint. Collision nodes follow the deformed geometry.
 */
export class VehicleStructure {
  readonly nodes:StructureNode[]=[];
  readonly beams:Beam[]=[];
  readonly colliderHandles=new Set<number>();
  readonly fragments:PhysicalFragment[]=[];
  plasticWorkJ=0;
  private api:Api;
  private world:RAPIER.World;
  private cabin:RAPIER.RigidBody;
  private cabinCollider:RAPIER.Collider;
  private spec:VehicleSpec;
  private cabinMass:number;

  constructor(api:Api,world:RAPIER.World,cabin:RAPIER.RigidBody,collider:RAPIER.Collider,spec:VehicleSpec){
    this.api=api;this.world=world;this.cabin=cabin;this.cabinCollider=collider;this.spec=spec;this.cabinMass=spec.mass*.72;
    this.colliderHandles.add(collider.handle);
    const [w,h,l]=spec.size,origin=cabin.translation(),rotation=cabin.rotation();
    for(const z of [-.48,-.30,-.12,.12,.30,.48])for(const upper of [false,true])for(const side of [-1,1]){
      const roof=Math.abs(z)<.2,assetOrigin=h*.53+.08;
      const low=spec.modelFile ? .565-assetOrigin : -h*.34;
      const high=spec.modelFile ? (roof ? h-assetOrigin-.10 : .90-assetOrigin) : h*(roof ? .57 : .04);
      const rest={x:side*w*(upper&&roof ? .36 : .43),y:upper?high:low,z:z*l};
      const anchor=!upper&&Math.abs(z)<.2;
      let body=cabin,nodeCollider:RAPIER.Collider|undefined;
      if(!anchor){
        const p=rotate(rest,rotation);
        body=world.createRigidBody(api.RigidBodyDesc.dynamic().setTranslation(origin.x+p.x,origin.y+p.y,origin.z+p.z)
          .lockRotations().setLinearDamping(.035).setCanSleep(false).setCcdEnabled(true));
        nodeCollider=world.createCollider(api.ColliderDesc.ball(.115).setMass(spec.mass*.28/20)
          .setFriction(.45).setRestitution(.02).setCollisionGroups(0x00020001)
          .setActiveEvents(api.ActiveEvents.COLLISION_EVENTS),body);
        this.colliderHandles.add(nodeCollider.handle);
      }
      this.nodes.push({rest,body,anchor,collider:nodeCollider,damage:0,detached:false});
    }
    const connect=(a:StructureNode,b:StructureNode,surface=false)=>{
      if(a.anchor&&b.anchor)return;
      // Keep a cabin anchor first, so each dynamic endpoint is an actual nodal mass.
      if(b.anchor)[a,b]=[b,a];
      const initial=length(sub(a.rest,b.rest)),stiffness=spec.mass*100*spec.resistance;
      const joint=this.makeSpring(a,b,initial,stiffness);
      const beam:Beam={a,b,initial,rest:initial,appliedRest:initial,stiffness,yieldForce:spec.mass*6*spec.resistance,joint,broken:false,clock:0,surfaceLength:initial};
      if(surface){
        beam.surface=world.createCollider(api.ColliderDesc.capsule(initial/2,.065).setDensity(0).setCollisionGroups(0x00020001)
          .setActiveEvents(api.ActiveEvents.COLLISION_EVENTS),spec.id==='concept'&&a.anchor?b.body:a.body);
        this.colliderHandles.add(beam.surface.handle);this.updateSurface(beam);
      }
      this.beams.push(beam);
    };
    for(let ring=0;ring<6;ring++){
      for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)connect(this.nodes[ring*4+a],this.nodes[ring*4+b],(a^b)!==3);
      if(ring<5)for(let a=0;a<4;a++)for(let b=0;b<4;b++)connect(this.nodes[ring*4+a],this.nodes[(ring+1)*4+b],a===b);
    }
  }
  private updateSurface(beam:Beam){
    if(!beam.surface)return;
    const a=this.worldPosition(beam.a),b=this.worldPosition(beam.b),parent=this.spec.id==='concept'&&beam.a.anchor?beam.b.body:beam.a.body,p=parent.translation(),q=parent.rotation(),inverse={x:-q.x,y:-q.y,z:-q.z,w:q.w};
    const direction=rotate(sub(b,a),inverse),distance=length(direction);
    if(distance<.01)return;
    if(Math.abs(distance-beam.surfaceLength)>.01){beam.surface.setShape(this.api.ColliderDesc.capsule(distance/2,.065).shape);beam.surfaceLength=distance}
    const midpoint=rotate({x:(a.x+b.x)/2-p.x,y:(a.y+b.y)/2-p.y,z:(a.z+b.z)/2-p.z},inverse);
    beam.surface.setTranslationWrtParent(midpoint);
    const dx=direction.x/distance,dy=direction.y/distance,dz=direction.z/distance;
    const norm=Math.hypot(dz,-dx,1+dy);
    beam.surface.setRotationWrtParent(norm<.001?{x:1,y:0,z:0,w:0}:{x:dz/norm,y:0,z:-dx/norm,w:(1+dy)/norm});
  }
  private makeSpring(a:StructureNode,b:StructureNode,rest:number,k:number){
    const reducedMass=a.anchor?b.body.mass():a.body.mass()*b.body.mass()/(a.body.mass()+b.body.mass());
    const damping=1.2*Math.sqrt(k*reducedMass);
    const joint=this.world.createImpulseJoint(this.api.JointData.spring(rest,k,damping,a.anchor?a.rest:zero(),b.anchor?b.rest:zero()),a.body,b.body,true);
    joint.setContactsEnabled(false);return joint;
  }
  worldPosition(node:StructureNode):Vec {
    if(!node.anchor)return node.body.translation();
    const v=rotate(node.rest,this.cabin.rotation()),p=this.cabin.translation();return {x:p.x+v.x,y:p.y+v.y,z:p.z+v.z};
  }
  localPosition(node:StructureNode):Vec {
    if(node.anchor)return node.rest;
    const q=this.cabin.rotation();return rotate(sub(node.body.translation(),this.cabin.translation()),{x:-q.x,y:-q.y,z:-q.z,w:q.w});
  }
  update(dt:number){
    for(const node of this.nodes)node.damage=0;
    for(const beam of this.beams){
      if(beam.broken){beam.a.damage=Math.max(beam.a.damage,.85);beam.b.damage=Math.max(beam.b.damage,.85);continue}
      const distance=length(sub(this.worldPosition(beam.a),this.worldPosition(beam.b)));
      const displacement=distance-beam.rest,force=beam.stiffness*Math.abs(displacement);
      const strain=distance/beam.initial;
      if(strain>1.65||strain<.12||Math.abs(beam.rest/beam.initial-1)>.24){
        this.world.removeImpulseJoint(beam.joint,true);beam.broken=true;beam.surface?.setEnabled(false);
        this.plasticWorkJ+=beam.yieldForce*Math.abs(displacement);
        beam.a.damage=Math.max(beam.a.damage,.85);beam.b.damage=Math.max(beam.b.damage,.85);continue;
      }
      if(force>beam.yieldForce){
        const excess=displacement-Math.sign(displacement)*beam.yieldForce/beam.stiffness;
        const next=clamp(beam.rest+excess*(1-Math.exp(-18*dt)),beam.initial*.15,beam.initial*1.6);
        this.plasticWorkJ+=beam.yieldForce*Math.abs(next-beam.rest);
        beam.rest=next;
      }
      beam.clock+=dt;
      if(beam.clock>=1/30&&Math.abs(beam.rest-beam.appliedRest)>.004){
        this.world.removeImpulseJoint(beam.joint,true);
        beam.joint=this.makeSpring(beam.a,beam.b,beam.rest,beam.stiffness);beam.appliedRest=beam.rest;beam.clock=0;
      }
      const damage=clamp(Math.abs(beam.rest-beam.initial)/beam.initial*3,0,1);
      beam.a.damage=Math.max(beam.a.damage,damage);beam.b.damage=Math.max(beam.b.damage,damage);
      this.updateSurface(beam);
    }
    for(const node of this.nodes)if(!node.anchor&&!node.detached&&!this.beams.some(b=>!b.broken&&(b.a===node||b.b===node))){
      node.detached=true;node.collider!.setCollisionGroups(0x00040005);
    }
    // Detachment belongs to the fixed physics step, never to the render frequency.
    if(this.brokenBeams){
      const [w,h,l]=this.spec.size;
      const parts=this.spec.id==='concept'?concept.parts.map(p=>({id:p.id,point:{x:p.center[0],y:p.center[1]-(h*.53+.08),z:p.center[2]},half:{x:p.half[0],y:p.half[1],z:p.half[2]},mass:p.mass,threshold:p.threshold})):[
        {id:'hood',point:{x:0,y:h*.04,z:l*.31},half:{x:w*.45,y:h*.05,z:l*.125},mass:12},
        {id:'front-bumper',point:{x:0,y:-h*.24,z:l*.49},half:{x:w*.42,y:h*.10,z:.08},mass:6},
        {id:'rear-bumper',point:{x:0,y:-h*.24,z:-l*.49},half:{x:w*.42,y:h*.10,z:.08},mass:6}
      ].map(p=>({...p,threshold:.32}));
      for(const part of parts){
        if(this.fragments.some(f=>f.id===part.id)||this.damageAt(part.point)<part.threshold)continue;
        const offset=this.displacementAt(part.point),rotated=rotate({x:part.point.x+offset.x,y:part.point.y+offset.y,z:part.point.z+offset.z},this.cabin.rotation()),origin=this.cabin.translation();
        this.releaseFragment(part.id,{x:origin.x+rotated.x,y:origin.y+rotated.y,z:origin.z+rotated.z},part.half,part.mass);
      }
    }
  }
  get damage(){
    const total=this.beams.reduce((sum,b)=>sum+b.initial,0);
    const changed=this.beams.reduce((sum,b)=>sum+(b.broken?b.initial*.35:Math.abs(b.rest-b.initial)),0);
    let intrusion=0;
    for(const node of this.nodes)if(!node.anchor&&node.damage>.02){
      intrusion=Math.max(intrusion,length(sub(this.localPosition(node),node.rest))/(this.spec.size[2]*.30));
    }
    return Math.round(clamp(Math.max(changed/total*480,intrusion*100),0,100));
  }
  get brokenBeams(){return this.beams.filter(b=>b.broken).length}
  get totalMass(){return this.cabin.mass()+this.nodes.reduce((sum,n)=>sum+(n.anchor?0:n.body.mass()),0)+this.fragments.reduce((sum,f)=>sum+f.body.mass(),0)}
  damageAt(point:Vec){
    let sum=0,weight=0;
    for(const node of this.nodes){const d=length(sub(node.rest,point)),w=1/(.02+d**4);sum+=node.damage*w;weight+=w}
    return sum/weight;
  }
  displacementAt(point:Vec,includeDetached=false):Vec {
    const result=zero();let weight=0;
    for(const node of this.nodes){
      if(node.detached&&!includeDetached)continue;
      const d=length(sub(node.rest,point)),w=1/(.01+d**4),p=this.localPosition(node);
      result.x+=(p.x-node.rest.x)*w;result.y+=(p.y-node.rest.y)*w;result.z+=(p.z-node.rest.z)*w;weight+=w;
    }
    if(weight){result.x/=weight;result.y/=weight;result.z/=weight}return result;
  }
  releaseFragment(id:string,position:Vec,halfExtents:Vec,mass:number,rotation=this.cabin.rotation()):PhysicalFragment {
    const old=this.fragments.find(f=>f.id===id);if(old)return old;
    const velocity=this.cabin.velocityAtPoint(position);
    const body=this.world.createRigidBody(this.api.RigidBodyDesc.dynamic().setTranslation(position.x,position.y,position.z)
      .setRotation(rotation).setLinvel(velocity.x,velocity.y,velocity.z).setAngularDamping(.2).setCcdEnabled(true));
    const spin=this.cabin.angvel();body.setAngvel(spin,true);
    const shape=id.startsWith('wheel-')
      ?this.api.ColliderDesc.cylinder(halfExtents.x,halfExtents.y).setRotation({x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2})
      :this.api.ColliderDesc.cuboid(halfExtents.x,halfExtents.y,halfExtents.z);
    this.world.createCollider(shape.setMass(mass).setCollisionGroups(0x00040005).setFriction(.6).setRestitution(.1),body);
    this.cabinMass-=mass;this.cabinCollider.setMass(this.cabinMass);
    const fragment={id,body,halfExtents};this.fragments.push(fragment);return fragment;
  }
}
