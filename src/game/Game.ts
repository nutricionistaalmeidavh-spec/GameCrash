import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {buildTrack,type Track} from './track';
import {createVehicle,type VehicleVisual} from './vehicle';
import {VehicleDynamics,PHYSICS_DT,EMPTY_INPUT} from './driving';
import {loadBrazilCar,loadBrazilScenery,disposeBrazilObject,type BrazilCarId,type BrazilMapId} from '../brazil/adapter';
import {SCENARIOS,VEHICLES,fictionalImpact,kmh,progressFraction,clamp,MAX_SPEED_KMH,SPEEDBUMPS,countBumpsPassed,clampSpeedLimit,type VehicleId,type ScenarioId,type GamePhase,type SceneryId} from './rules';

export interface Result {speed:number;damage:number;survival:number;avoided:boolean;scenario:ScenarioId;bumpsPassed:number}
export interface Telemetry {speed:number;distance:number;integrity:number;phase:GamePhase;progress:number;bumpsPassed:number}
export interface GameOptions {onTelemetry(value:Telemetry):void;onResult(result:Result):void}
export interface Controls {left:boolean;right:boolean;brake:boolean;throttle:boolean}
export class Game {
  private renderer:THREE.WebGLRenderer;
  private scene=new THREE.Scene();
  private camera=new THREE.PerspectiveCamera(55,1,.05,1500);
  private clock=new THREE.Clock();
  private world!:RAPIER.World;
  private queue!:RAPIER.EventQueue;
  private body!:RAPIER.RigidBody;
  private collider!:RAPIER.Collider;
  private driving!:VehicleDynamics;
  private track!:Track;
  private visual!:VehicleVisual;
  private phase:GamePhase='ready';
  private vehicleId:VehicleId='sedan';
  private scenarioId:ScenarioId='wall';
  private sceneryId:SceneryId='original';
  private scenery?:THREE.Group;
  private carAsset?:THREE.Group;
  private resourceRevision=0;
  private controls:Controls={left:false,right:false,brake:false,throttle:false};
  private elapsed=0;
  private overturnedTime=0;
  private integrity=100;
  private accumulator=0;
  private lastTelemetry=0;
  private hitSpeed=0;
  private speedLimitKmh=MAX_SPEED_KMH;
  private lastBumpIndex=0;
  private bumpDamage=0;
  private hadAir=false;
  private viewMode:0|1=0;
  private raf=0;
  private readonly timestep=PHYSICS_DT;
  private readonly boxPosition=new THREE.Vector3();
  private readonly heading=new THREE.Vector3();
  private readonly cameraTarget=new THREE.Vector3();
  constructor(private canvas:HTMLCanvasElement,private options:GameOptions){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(1.7,window.devicePixelRatio||1));
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.43;
    this.scene.background=new THREE.Color(0x9caeb2);
    this.scene.fog=new THREE.FogExp2(0x9caeb2,.0038);
    const hemi=new THREE.HemisphereLight(0xe7efff,0x53624b,2.05);this.scene.add(hemi);
    const sun=new THREE.DirectionalLight(0xfff3d9,2.1);
    sun.position.set(-60,100,80);sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);
    sun.shadow.camera.left=-38;sun.shadow.camera.right=38;sun.shadow.camera.top=38;sun.shadow.camera.bottom=-38;
    sun.shadow.normalBias=.038;this.scene.add(sun);
    this.camera.position.set(6,5,-13);
    window.addEventListener('resize',this.resize);
    this.resize();
  }
  async init(){await RAPIER.init();this.reset();this.clock.start();this.frame();}
  get phaseState(){return this.phase}
  selectVehicle(id:VehicleId){this.vehicleId=id;this.reset()}
  selectScenario(id:ScenarioId){this.scenarioId=id;this.reset()}
  selectScenery(id:SceneryId){this.sceneryId=id;this.reset()}
  toggleCamera(){this.viewMode=this.viewMode===0?1:0}
  setControls(patch:Partial<Controls>){Object.assign(this.controls,patch)}
  setSpeedLimitKmh(value:number){this.speedLimitKmh=clampSpeedLimit(value)}
  start(){this.reset();this.phase='running'}
  returnToGarage(){this.reset()}
  private reset(){
    const revision=++this.resourceRevision;
    if(this.scenery){this.scene.remove(this.scenery);disposeBrazilObject(this.scenery);this.scenery=undefined}
    this.carAsset=undefined;
    if(this.track)this.track.dispose();
    if(this.visual){
      this.scene.remove(this.visual.root);
      this.visual.root.traverse((obj)=>{if(obj instanceof THREE.Mesh){obj.geometry.dispose(); const m=obj.material; if(Array.isArray(m))m.forEach(x=>x.dispose());else m.dispose()}});
    }
    if(this.world)this.world.free();
    if(this.queue)this.queue.free();
    this.world=new RAPIER.World({x:0,y:-9.81,z:0});
    this.world.timestep=this.timestep;
    this.queue=new RAPIER.EventQueue(true);
    this.track=buildTrack(this.scene,this.world,this.scenarioId);
    const spec=VEHICLES[this.vehicleId];
    this.visual=createVehicle(spec);this.scene.add(this.visual.root);
    const visual=this.visual;
    if(spec.modelFile){
      void loadBrazilCar(this.vehicleId as BrazilCarId).then(asset=>{
        if(this.resourceRevision!==revision || visual!==this.visual){disposeBrazilObject(asset);return}
        // The existing Rapier body is centered on the chassis; GLBs use ground-relative Y.
        asset.position.y=-(spec.size[1]*.53+.08);
        // Keep animated wheels; replace only the reserve body with the selected local GLB.
        visual.root.children.forEach(obj=>obj.visible=visual.wheels.includes(obj as THREE.Group));
        asset.traverse(obj=>{if(obj.name.startsWith('wheel_'))obj.visible=false});
        visual.root.add(asset);this.carAsset=asset;
        visual.addDamageMeshes(asset);
      }).catch(error=>console.warn('Carro brasileiro: usando modelo de reserva',error));
    }
    if(this.sceneryId!=='original'){
      void loadBrazilScenery(this.sceneryId as BrazilMapId).then(map=>{
        if(this.resourceRevision!==revision){disposeBrazilObject(map);return}
        this.scenery=map;this.scene.add(map);
      }).catch(error=>console.warn('Paisagem brasileira: usando pista padrão',error));
    }
    this.driving=new VehicleDynamics(RAPIER,this.world,spec);
    this.body=this.driving.body;this.collider=this.driving.collider;
    // Settle the springs before showing the parked vehicle.
    for(let i=0;i<120;i++){this.driving.update(EMPTY_INPUT,this.speedLimitKmh);this.world.step()}
    this.queue.drainCollisionEvents(()=>{});
    this.phase='ready';this.controls={left:false,right:false,brake:false,throttle:false};
    this.hitSpeed=0;this.hadAir=false;this.accumulator=0;this.lastBumpIndex=0;this.bumpDamage=0;
    this.elapsed=0;this.overturnedTime=0;this.integrity=100;
    const position=this.body.translation();this.visual.root.position.set(position.x,position.y,position.z);
    this.camera.position.set(5,5.5,-12);this.cameraTarget.set(0,position.y,6);
    this.options.onTelemetry({phase:'ready',speed:0,distance:0,integrity:100,progress:0,bumpsPassed:0});
  }
  private readonly resize=()=>{const w=window.innerWidth,h=window.innerHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/Math.max(1,h);this.camera.fov=w<700?66:55;this.camera.updateProjectionMatrix()};
  private step(){
    if(this.phase==='ready')return;
    const dt=this.timestep;
    const incoming={...this.body.linvel()};
    this.driving.update(this.phase==='running'?this.controls:EMPTY_INPUT,this.speedLimitKmh);
    if(this.phase==='running')this.hitSpeed=kmh(this.driving.speed);
    this.world.step(this.queue);
    if(this.phase==='running'){
      this.elapsed+=dt;
      let impacted=false;
      this.queue.drainCollisionEvents((a,b,started)=>{
        if(!started)return;
        if((a===this.collider.handle&&this.track.obstacleHandles.has(b))||(b===this.collider.handle&&this.track.obstacleHandles.has(a))){
          impacted=true;
          // Use closing speed along the surface normal, not full forward speed on a glancing hit.
          this.world.contactPair(this.world.getCollider(a),this.world.getCollider(b),manifold=>{
            const n=manifold.normal();
            this.hitSpeed=kmh(Math.abs(incoming.x*n.x+incoming.y*n.y+incoming.z*n.z));
          });
        }
      });
      const p=this.body.translation();
      const q=this.body.rotation();
      this.overturnedTime=(1-2*(q.x*q.x+q.z*q.z))<.15?this.overturnedTime+dt:0;
      if(p.y< -6||Math.abs(p.x)>45||this.overturnedTime>3){this.finish(false);return}
      if(this.scenarioId==='speedbumps'){
        if(Math.abs(p.x)>10){this.finish(false);return}
        const passed=countBumpsPassed(p.z);
        if(passed>this.lastBumpIndex){
          this.lastBumpIndex=passed;
        }
        // Damage follows suspension load and landings; crossing a Z coordinate adds no impulse.
        const impactVelocity=Math.max(0,this.body.linvel().y-incoming.y-9.81*dt);
        if(impactVelocity>1.4)this.bumpDamage=clamp(this.bumpDamage+(impactVelocity-1.4)*.7/VEHICLES[this.vehicleId].resistance,0,100);
        this.integrity=100-Math.round(this.bumpDamage);
        if(this.bumpDamage>=100){this.finish(false);return}
        if(p.z>=SPEEDBUMPS.finishZ)this.finish(true);
        else if(this.elapsed>120)this.finish(false);
        return;
      }
      if(this.scenarioId==='ramp'){
        if(p.z>SCENARIOS.ramp.z-8&&this.driving.groundedWheels===0)this.hadAir=true;
        if(this.hadAir&&this.driving.groundedWheels>0&&incoming.y< -3.5){impacted=true;this.hitSpeed=kmh(Math.abs(incoming.y))}
      }
      if(impacted){this.finish(false)}
      else if(p.z>SCENARIOS[this.scenarioId].z+(this.scenarioId==='ramp'?100:22))this.finish(true);
      else if(this.elapsed>90){this.finish(false)}
    }
  }
  private finish(avoided:boolean){
    if(this.phase!=='running')return;
    this.phase='crashed';
    this.controls={...EMPTY_INPUT};
    const speed=Math.round(this.hitSpeed);
    if(this.scenarioId==='speedbumps'){
      const damage=Math.round(this.bumpDamage);
      this.integrity=100-damage;
      if(damage>0)this.visual.deform(damage);
      this.options.onResult({speed,damage,survival:Math.max(1,100-Math.round(damage*.9)),avoided,scenario:this.scenarioId,bumpsPassed:this.lastBumpIndex});
      return;
    }
    const impact=fictionalImpact(avoided?0:speed,VEHICLES[this.vehicleId],this.scenarioId);
    this.integrity=avoided?100:100-impact.damage;
    if(!avoided)this.visual.deform(impact.damage);
    this.options.onResult({speed:avoided?0:speed,damage:impact.damage,survival:avoided?100:impact.survival,avoided,scenario:this.scenarioId,bumpsPassed:0});
  }
  private frame=()=>{
    this.raf=requestAnimationFrame(this.frame);
    const dt=Math.min(.07,this.clock.getDelta());
    if(document.hidden){this.accumulator=0;return}
    const timeScale=this.phase==='crashed'?.32:1;
    this.accumulator+=dt*timeScale;
    let safety=0;
    while(this.accumulator>=this.timestep&&safety++<10){this.step();this.accumulator-=this.timestep}
    if(safety>=10)this.accumulator=0;
    const t=this.body?.translation();
    if(t&&this.visual){
      const q=this.body.rotation();
      this.visual.root.position.set(t.x,t.y,t.z);
      this.visual.root.quaternion.set(q.x,q.y,q.z,q.w);
      this.visual.updateWheels(this.driving.controller);
      // Follow the heading with a level horizon; let the chassis visibly pitch and roll.
      this.heading.set(0,0,1).applyQuaternion(this.visual.root.quaternion).setY(0);
      if(this.heading.lengthSq()<.1)this.heading.set(0,0,1);else this.heading.normalize();
      const side=this.viewMode===0?1.5:10,back=this.viewMode===0?11:5;
      this.boxPosition.set(t.x-this.heading.x*back+this.heading.z*side,t.y+4,t.z-this.heading.z*back-this.heading.x*side);
      this.camera.position.lerp(this.boxPosition,Math.min(1,dt*3.8));
      this.boxPosition.set(t.x+this.heading.x*5,t.y+.3,t.z+this.heading.z*5);
      this.cameraTarget.lerp(this.boxPosition,1-Math.exp(-6*dt));
      this.camera.lookAt(this.cameraTarget);
      if(performance.now()-this.lastTelemetry>90){
        const speed=kmh(this.phase==='ready'?0:this.driving.speed);
        this.options.onTelemetry({speed:Math.round(speed),distance:Math.max(0,Math.round(t.z)),integrity:this.integrity,phase:this.phase,progress:progressFraction(t.z,this.scenarioId),bumpsPassed:this.lastBumpIndex});
        this.lastTelemetry=performance.now();
      }
    }
    this.renderer.render(this.scene,this.camera);
  };
  dispose(){++this.resourceRevision;if(this.scenery){this.scene.remove(this.scenery);disposeBrazilObject(this.scenery)}cancelAnimationFrame(this.raf);window.removeEventListener('resize',this.resize);this.track?.dispose();this.queue?.free();this.world?.free();this.renderer.dispose()}
}
