import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {buildTrack,type Track} from './track';
import {createVehicle,type VehicleVisual} from './vehicle';
import {SCENARIOS,VEHICLES,fictionalImpact,kmh,progressFraction,clamp,type VehicleId,type ScenarioId,type GamePhase,type SceneryId} from './rules';
import {loadBrazilCar,loadBrazilScenery,disposeBrazilObject,type BrazilCarId,type BrazilMapId} from '../brazil/adapter';

export interface Result {speed:number;damage:number;survival:number;avoided:boolean;scenario:ScenarioId}
export interface Telemetry {speed:number;distance:number;integrity:number;phase:GamePhase;progress:number}
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
  private startedAt=0;
  private accumulator=0;
  private lastTelemetry=0;
  private hitSpeed=0;
  private hadAir=false;
  private viewMode:0|1=0;
  private raf=0;
  private readonly timestep=1/60;
  private readonly boxPosition=new THREE.Vector3();
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
  start(){if(this.phase==='running')return;this.reset();this.phase='running';this.controls.throttle=false;this.startedAt=performance.now()}
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
        visual.root.children.forEach(obj=>obj.visible=false);
        visual.root.add(asset);this.carAsset=asset;
        const oldDeform=visual.deform.bind(visual);
        visual.deform=(damage)=>{
          oldDeform(damage);
          asset.scale.z=Math.max(.48,1-damage*.004);
          asset.rotation.x=damage*.0016;
        };
      }).catch(error=>console.warn('Carro brasileiro: usando modelo de reserva',error));
    }
    if(this.sceneryId!=='original'){
      void loadBrazilScenery(this.sceneryId as BrazilMapId).then(map=>{
        if(this.resourceRevision!==revision){disposeBrazilObject(map);return}
        this.scenery=map;this.scene.add(map);
      }).catch(error=>console.warn('Paisagem brasileira: usando pista padrão',error));
    }
    const [w,h,l]=spec.size;
    this.body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,h*.53+0.08,0).setLinearDamping(.18).setAngularDamping(1.6).setCcdEnabled(true));
    this.collider=this.world.createCollider(RAPIER.ColliderDesc.cuboid(w*.47,h*.47,l*.48).setDensity(spec.mass/(w*h*l)).setFriction(1).setRestitution(.05).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),this.body);
    this.phase='ready';this.controls={left:false,right:false,brake:false,throttle:false};
    this.hitSpeed=0;this.hadAir=false;this.accumulator=0;
    this.visual.root.position.set(0,h*.53+.08,0);
    this.camera.position.set(5,5.5,-12);
    this.options.onTelemetry({phase:'ready',speed:0,distance:0,integrity:100,progress:0});
  }
  private readonly resize=()=>{const w=window.innerWidth,h=window.innerHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/Math.max(1,h);this.camera.fov=w<700?66:55;this.camera.updateProjectionMatrix()};
  private step(){
    if(this.phase==='ready')return;
    const dt=this.timestep;
    if(this.phase==='running'){
      const spec=VEHICLES[this.vehicleId];
      const prev=this.body.linvel();
      const steer=(Number(this.controls.right)-Number(this.controls.left));
      const vx=clamp(prev.x*.94+steer*dt*(5+kmh(prev.z)*.09),-10.2,10.2);
      const forward=clamp(prev.z+(this.controls.brake?-27:(this.controls.throttle?spec.acceleration:0)-1.3)*dt,0,spec.maxSpeed/3.6);
      this.body.setLinvel({x:vx,y:prev.y,z:forward},true);
      // Upright arcade stabilization while driving; physics takes over after impact.
      const desiredYaw=-steer*.045;
      this.body.setRotation({x:0,y:Math.sin(desiredYaw/2),z:0,w:Math.cos(desiredYaw/2)},true);
      this.body.setAngvel({x:0,y:0,z:0},true);
      this.hitSpeed=kmh(forward);
      this.visual.spin(forward*dt);
    }
    this.world.step(this.queue);
    if(this.phase==='running'){
      let impacted=false;
      this.queue.drainCollisionEvents((a,b,started)=>{
        if(!started)return;
        if((a===this.collider.handle&&this.track.obstacleHandles.has(b))||(b===this.collider.handle&&this.track.obstacleHandles.has(a)))impacted=true;
      });
      const p=this.body.translation();
      if(this.scenarioId==='ramp'){
        if(p.z>SCENARIOS.ramp.z-8&&p.y>2.3)this.hadAir=true;
        if(this.hadAir&&p.z>SCENARIOS.ramp.z+13&&p.y<1.0&&this.body.linvel().y<0)impacted=true;
      }
      if(impacted){this.finish(false)}
      else if(p.z>SCENARIOS[this.scenarioId].z+(this.scenarioId==='ramp'?100:22))this.finish(true);
      else if((performance.now()-this.startedAt)>30000){this.finish(true)}
    }
  }
  private finish(avoided:boolean){
    if(this.phase!=='running')return;
    this.phase='crashed';
    const speed=avoided?0:Math.round(this.hitSpeed);
    const impact=fictionalImpact(speed,VEHICLES[this.vehicleId],this.scenarioId);
    if(!avoided)this.visual.deform(impact.damage);
    this.options.onResult({speed,damage:impact.damage,survival:avoided?100:impact.survival,avoided,scenario:this.scenarioId});
  }
  private frame=()=>{
    this.raf=requestAnimationFrame(this.frame);
    const dt=Math.min(.07,this.clock.getDelta());
    const timeScale=this.phase==='crashed'?.32:1;
    this.accumulator+=dt*timeScale;
    let safety=0;
    while(this.accumulator>=this.timestep&&safety++<5){this.step();this.accumulator-=this.timestep}
    if(safety>=5)this.accumulator=0;
    const t=this.body?.translation();
    if(t&&this.visual){
      const q=this.body.rotation();
      this.visual.root.position.set(t.x,t.y,t.z);
      this.visual.root.quaternion.set(q.x,q.y,q.z,q.w);
      this.boxPosition.set(t.x+(this.viewMode===0?2.3:13),t.y+(this.viewMode===0?5:5.5),t.z+(this.viewMode===0?-13:-7));
      this.camera.position.lerp(this.boxPosition,Math.min(1,dt*3.8));
      this.camera.lookAt(t.x,t.y+1,t.z+this.viewMode*3+6);
      if(performance.now()-this.lastTelemetry>90){
        const speed=kmh(this.body.linvel().z);
        this.options.onTelemetry({speed:Math.round(speed),distance:Math.max(0,Math.round(t.z)),integrity:this.phase==='crashed'?Math.max(0,100-Math.min(100,fictionalImpact(this.hitSpeed,VEHICLES[this.vehicleId],this.scenarioId).damage)):100,phase:this.phase,progress:progressFraction(t.z,this.scenarioId)});
        this.lastTelemetry=performance.now();
      }
    }
    this.renderer.render(this.scene,this.camera);
  };
  dispose(){++this.resourceRevision;if(this.scenery){this.scene.remove(this.scenery);disposeBrazilObject(this.scenery)}cancelAnimationFrame(this.raf);window.removeEventListener('resize',this.resize);this.track?.dispose();this.queue?.free();this.world?.free();this.renderer.dispose()}
}
