import * as THREE from 'three';

export type CameraPhase='ready'|'running'|'crashed';

/** A world-up camera. Roll and pitch move the car, not the camera's horizon.
 * Movement supplies a stable forward reference while a chassis is upside down.
 * The camera looks at the center of the car instead of a distant point on the road.
 */
export class CameraFollower {
  readonly position=new THREE.Vector3();
  readonly target=new THREE.Vector3();
  readonly heading=new THREE.Vector3(0,0,1);
  private readonly forward=new THREE.Vector3();
  private readonly up=new THREE.Vector3();
  private readonly desired=new THREE.Vector3();
  private readonly focus=new THREE.Vector3();
  private initialized=false;

  reset(position:THREE.Vector3){
    this.position.set(position.x+5,position.y+5.5,position.z-12);
    this.target.copy(position).add(new THREE.Vector3(0,.45,0));
    this.heading.set(0,0,1);
    this.initialized=true;
  }

  update(
    position:THREE.Vector3,
    orientation:THREE.Quaternion,
    velocity:THREE.Vector3,
    dt:number,
    phase:CameraPhase,
    viewMode:0|1,
    orbitYaw=0,
    orbitPitch=0
  ){
    const delta=Math.max(0,Math.min(.07,Number.isFinite(dt)?dt:0));
    if(!this.initialized)this.reset(position);
    this.up.set(0,1,0).applyQuaternion(orientation);
    const speed=Math.hypot(velocity.x,velocity.z);
    // Project chassis heading only when reasonably upright. When it rolls or
    // pitches into a flip, follow the direction of travel to prevent a 180° spin.
    if(this.up.y>.38){
      this.forward.set(0,0,1).applyQuaternion(orientation).setY(0);
      if(this.forward.lengthSq()>.05)this.forward.normalize();
      else this.forward.copy(this.heading);
    }else if(speed>2.5){
      this.forward.set(velocity.x/speed,0,velocity.z/speed);
    }else this.forward.copy(this.heading);
    const rotateSpeed=phase==='ready'?1:phase==='crashed'?2.8:5.8;
    this.heading.lerp(this.forward,1-Math.exp(-rotateSpeed*delta)).setY(0);
    if(this.heading.lengthSq()<.01)this.heading.set(0,0,1);
    else this.heading.normalize();

    const side=phase==='ready'?5:viewMode===0?1.6:10;
    const back=phase==='ready'?7:viewMode===0?12:6;
    this.forward.copy(this.heading);
    if(phase==='crashed'&&orbitYaw!==0)this.forward.applyAxisAngle(THREE.Object3D.DEFAULT_UP,orbitYaw);
    const height=phase==='ready'?5:3.8+Math.max(-.7,Math.min(.8,orbitPitch))*5;
    this.desired.set(
      position.x-this.forward.x*back+this.forward.z*side,
      position.y+height,
      position.z-this.forward.z*back-this.forward.x*side
    );
    // Speed-adaptive damping keeps up with immediate 200 km/h acceleration and
    // 600 km/h impacts, unlike a fixed factor which lags meters behind each frame.
    const tracking=10+Math.min(68,speed*1.2);
    this.position.lerp(this.desired,1-Math.exp(-tracking*delta));
    const gap=this.position.distanceTo(this.desired);
    if(gap>3.2)this.position.lerp(this.desired,1-3.2/gap);

    // Target the chassis itself, not a point five metres ahead. Bound the
    // focus delay so an upside-down airborne car can never drift off screen.
    this.focus.copy(position).y+=.45;
    this.target.lerp(this.focus,1-Math.exp(-Math.max(20,tracking)*delta));
    const targetError=this.target.distanceTo(this.focus);
    if(targetError>.8)this.target.lerp(this.focus,1-.8/targetError);
    return this;
  }
}
