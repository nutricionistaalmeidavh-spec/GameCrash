import type * as RAPIER from '@dimforge/rapier3d-compat';
import {clamp,clampSpeedLimit,type VehicleSpec} from './rules.ts';
import {VehicleStructure,rotate,type PhysicalFragment} from './structure.ts';

export interface DriveInput {left:boolean;right:boolean;brake:boolean;throttle:boolean}
export const PHYSICS_DT=1/120;
export const EMPTY_INPUT:DriveInput={left:false,right:false,brake:false,throttle:false};

export function wheelLayout(spec:VehicleSpec){
  const brazilian=Boolean(spec.modelFile);
  const radius=brazilian ? .34 : spec.id==='suv' ? .41 : .36;
  const rest=.30;
  const axleZ=(spec.wheelbase??spec.size[2]*.63)/2;
  const y=brazilian ? .34-(spec.size[1]*.53+.08) : -spec.size[1]*.39;
  return {radius,rest,y,axleZ,halfTrack:spec.size[0]*.49};
}

/** Four suspension rays support a free rigid chassis. No pose or velocity overrides. */
export class VehicleDynamics {
  readonly body:RAPIER.RigidBody;
  readonly collider:RAPIER.Collider;
  readonly controller:RAPIER.DynamicRayCastVehicleController;
  readonly layout:ReturnType<typeof wheelLayout>;
  readonly structure:VehicleStructure;
  readonly wheelHealth=[1,1,1,1];
  readonly wheelFragments:Array<PhysicalFragment|undefined>=new Array(4);
  steering=0;
  readonly spec:VehicleSpec;

  constructor(api:Pick<typeof RAPIER,'RigidBodyDesc'|'ColliderDesc'|'ActiveEvents'|'JointData'>,world:RAPIER.World,spec:VehicleSpec){
    this.spec=spec;
    this.layout=wheelLayout(spec);
    const [w,h,l]=spec.size;
    this.body=world.createRigidBody(api.RigidBodyDesc.dynamic()
      .setTranslation(0,this.layout.radius-this.layout.y+.12,0)
      .setLinearDamping(.015).setAngularDamping(.45).setCanSleep(false).setCcdEnabled(true));
    this.collider=world.createCollider(api.ColliderDesc.cuboid(w*.45,h*.24,l*.16)
      .setTranslation(0,-h*.14,0).setMass(spec.mass*.72).setFriction(.35).setRestitution(.05).setCollisionGroups(0x00020001)
      .setActiveEvents(api.ActiveEvents.COLLISION_EVENTS),this.body);
    this.structure=new VehicleStructure(api,world,this.body,this.collider,spec);
    const vehicle=this.controller=world.createVehicleController(this.body);
    vehicle.indexUpAxis=1;
    vehicle.setIndexForwardAxis=2;
    // Wheel order matches the visual: left rear, left front, right rear, right front.
    for(const x of [-this.layout.halfTrack,this.layout.halfTrack])for(const z of [-this.layout.axleZ,this.layout.axleZ]){
      const i=vehicle.numWheels();
      vehicle.addWheel({x,y:this.layout.y+this.layout.rest,z},{x:0,y:-1,z:0},{x:-1,y:0,z:0},this.layout.rest,this.layout.radius);
      vehicle.setWheelSuspensionStiffness(i,38/.72);
      vehicle.setWheelSuspensionCompression(i,8);
      vehicle.setWheelSuspensionRelaxation(i,10);
      vehicle.setWheelMaxSuspensionTravel(i,.22);
      vehicle.setWheelMaxSuspensionForce(i,spec.mass*9.81*.8);
      vehicle.setWheelFrictionSlip(i,2.2);
      vehicle.setWheelSideFrictionStiffness(i,1);
    }
  }

  get signedSpeed(){
    const q=this.body.rotation(),v=this.body.linvel();
    // World-space local +Z, dotted with velocity (valid through yaw, pitch and roll).
    return v.x*2*(q.x*q.z+q.w*q.y)+v.y*2*(q.y*q.z-q.w*q.x)+v.z*(1-2*(q.x*q.x+q.y*q.y));
  }
  get speed(){const v=this.body.linvel();return Math.hypot(v.x,v.y,v.z)}
  get groundedWheels(){let count=0;for(let i=0;i<4;i++)if(this.controller.wheelIsInContact(i))count++;return count}

  update(input:DriveInput,limitKmh:number,dt=PHYSICS_DT){
    this.structure.update(dt);
    const speed=Math.abs(this.signedSpeed);
    // Smooth steering with a smaller lock at high speeds, instead of lateral translation.
    const maxSteer=.48/(1+speed*.085);
    const target=(Number(input.right)-Number(input.left))*maxSteer;
    this.steering+=(target-this.steering)*(1-Math.exp(-9*dt));
    const limit=clampSpeedLimit(limitKmh)/3.6;
    const governor=clamp((limit-speed)/3,0,1);
    const force=input.throttle&&!input.brake?this.spec.mass*this.spec.acceleration*2*governor/4:0;
    // Rapier's brake is an impulse per wheel, so scale by the fixed physics interval.
    const braking=input.brake?19:speed>limit?8:!input.throttle&&speed<.35?5:0;
    for(let i=0;i<4;i++){
      const point={x:(i<2?-1:1)*this.layout.halfTrack,y:this.layout.y,z:(i%2===0?-1:1)*this.layout.axleZ};
      const damage=this.structure.damageAt(point),health=this.wheelHealth[i]=clamp(1-damage*1.25,0,1);
      const offset=this.structure.displacementAt(point);
      this.controller.setWheelChassisConnectionPointCs(i,{x:point.x+clamp(offset.x,-.35,.35),y:point.y+this.layout.rest+clamp(offset.y,-.20,.20),z:point.z+clamp(offset.z,-.55,.55)});
      if(health<.12&&this.structure.brokenBeams>0&&!this.wheelFragments[i]){
        const local=rotate({x:point.x+offset.x,y:point.y+offset.y,z:point.z+offset.z},this.body.rotation()),p=this.body.translation();
        this.wheelFragments[i]=this.structure.releaseFragment('wheel-'+i,{x:p.x+local.x,y:p.y+local.y,z:p.z+local.z},{x:.14,y:this.layout.radius,z:this.layout.radius},this.spec.mass*.015);
      }
      const detached=Boolean(this.wheelFragments[i]);
      this.controller.setWheelEngineForce(i,detached?0:force*health);
      this.controller.setWheelBrake(i,detached?0:this.spec.mass*braking*dt/4*(.25+.75*health));
      this.controller.setWheelFrictionSlip(i,detached?0:2.2*(.25+.75*health));
      this.controller.setWheelMaxSuspensionForce(i,detached?0:this.spec.mass*9.81*.8*(.3+.7*health));
      const toe=clamp(offset.x*.3,-.16,.16)*damage;
      this.controller.setWheelSteering(i,(i%2===1?this.steering*health:0)+toe);
    }
    this.controller.updateVehicle(dt,undefined,undefined,c=>!this.structure.colliderHandles.has(c.handle));
    const v=this.body.linvel();
    // Rolling resistance and aerodynamic drag also act when the accelerator is released.
    const drag=(.28+.00012*this.speed*this.speed)*this.spec.mass*dt;
    const factor=Math.min(this.spec.mass*this.speed,drag)/Math.max(.001,this.speed);
    this.body.applyImpulse({x:-v.x*factor,y:0,z:-v.z*factor},true);
  }
}
