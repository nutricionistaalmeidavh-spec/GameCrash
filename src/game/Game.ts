import {Sky} from 'three/addons/objects/Sky.js';
import {loadConcept} from './concept';
import {AdaptiveRenderQuality} from './quality';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {buildTrack,type Track} from './track';
import {createVehicle,type VehicleVisual} from './vehicle';
import {VehicleDynamics,PHYSICS_DT,EMPTY_INPUT} from './driving';
import {loadBrazilCar,loadBrazilScenery,disposeBrazilObject,type BrazilCarId,type BrazilMapId} from '../brazil/adapter';
import {SCENARIOS,VEHICLES,kmh,progressFraction,clamp,MAX_SPEED_KMH,SPEEDBUMPS,countBumpsPassed,clampSpeedLimit,type VehicleId,type ScenarioId,type GamePhase,type SceneryId} from './rules';

export interface Result {speed:number;damage:number;survival:number;avoided:boolean;scenario:ScenarioId;bumpsPassed:number;brokenBeams:number;detachedParts:number;deformationEnergyKJ:number}
export interface Telemetry {speed:number;distance:number;integrity:number;phase:GamePhase;progress:number;bumpsPassed:number}
export interface GameOptions {onTelemetry(value:Telemetry):void;onResult(result:Result):void}
export interface Controls {left:boolean;right:boolean;brake:boolean;throttle:boolean}
export class Game {
  private renderer:THREE.WebGLRenderer;
  private environment:THREE.WebGLRenderTarget;
  private sun:THREE.DirectionalLight;
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
  private vehicleId:VehicleId='concept';
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
  private pendingResult?:{avoided:boolean;speed:number;age:number};
  private crashReport?:Result;
  private playback=.32;
  private orbitYaw=0;
  private orbitPitch=0;
  private drag?:{id:number;x:number;y:number};
  private hadAir=false;
  private viewMode:0|1=0;
  private raf=0;
  private deformationElapsed=0;
  private readonly quality:AdaptiveRenderQuality;
  private readonly timestep=PHYSICS_DT;
  private readonly boxPosition=new THREE.Vector3();
  private readonly heading=new THREE.Vector3();
  private readonly cameraTarget=new THREE.Vector3();
  constructor(private canvas:HTMLCanvasElement,private options:GameOptions){
    const coarsePointer=window.matchMedia?.('(pointer: coarse)').matches??false;
    this.quality=new AdaptiveRenderQuality(coarsePointer||window.innerWidth<700);
    canvas.dataset.renderProfile=this.quality.mobile?'mobile':'desktop';
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(this.quality.configure(window.innerWidth,window.innerHeight,window.devicePixelRatio||1));
    this.renderer.transmissionResolutionScale=.25;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.1;
    const pmrem=new THREE.PMREMGenerator(this.renderer),sky=new Sky(),outdoors=new THREE.Scene();
    sky.scale.setScalar(1000);
    sky.material.uniforms.turbidity.value=4;sky.material.uniforms.rayleigh.value=2;
    sky.material.uniforms.mieCoefficient.value=.004;sky.material.uniforms.mieDirectionalG.value=.8;
    sky.material.uniforms.sunPosition.value.set(-35,65,35);outdoors.add(sky);
    this.environment=pmrem.fromScene(outdoors,.035);
    this.scene.environment=this.environment.texture;
    this.scene.environmentIntensity=.65;
    sky.geometry.dispose();sky.material.dispose();pmrem.dispose();
    this.scene.background=new THREE.Color(0xadc2cc);
    this.scene.fog=new THREE.FogExp2(0xadc2cc,.0038);
    const hemi=new THREE.HemisphereLight(0xe7efff,0x53624b,2.05);this.scene.add(hemi);
    const sun=this.sun=new THREE.DirectionalLight(0xfff3d9,2.1);
    sun.position.set(-60,100,80);sun.castShadow=true;
    sun.shadow.mapSize.set(this.quality.shadowMapSize,this.quality.shadowMapSize);
    sun.shadow.camera.left=-38;sun.shadow.camera.right=38;sun.shadow.camera.top=38;sun.shadow.camera.bottom=-38;
    sun.shadow.normalBias=.025;sun.shadow.bias=-.00015;this.scene.add(sun,sun.target);
    this.camera.position.set(6,5,-13);
    window.addEventListener('resize',this.resize);
    canvas.addEventListener('pointerdown',this.orbitStart);
    canvas.addEventListener('pointermove',this.orbitMove);
    canvas.addEventListener('pointerup',this.orbitEnd);
    canvas.addEventListener('pointercancel',this.orbitEnd);
    this.resize();
  }
  async init(){await RAPIER.init();this.reset();this.clock.start();this.frame();}
  get phaseState(){return this.phase}
  selectVehicle(id:VehicleId){this.vehicleId=id;this.reset()}
  selectScenario(id:ScenarioId){this.scenarioId=id;this.reset()}
  selectScenery(id:SceneryId){this.sceneryId=id;this.reset()}
  toggleCamera(){this.viewMode=this.viewMode===0?1:0}
  setImpactPlayback(value:number){this.playback=clamp(value,0,1)}
  resultSnapshot():Result|undefined {
    if(!this.crashReport)return;
    const structure=this.driving.structure,damage=structure.damage;
    return {...this.crashReport,damage,survival:Math.max(1,100-Math.round(.92*damage**1.08)),brokenBeams:structure.brokenBeams,detachedParts:structure.fragments.length,deformationEnergyKJ:Math.round(structure.plasticWorkJ/1000)};
  }
  private readonly orbitStart=(e:PointerEvent)=>{if(this.phase!=='crashed')return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};this.canvas.setPointerCapture(e.pointerId)};
  private readonly orbitMove=(e:PointerEvent)=>{if(this.drag?.id!==e.pointerId)return;this.orbitYaw+=(e.clientX-this.drag.x)*.008;this.orbitPitch=clamp(this.orbitPitch+(e.clientY-this.drag.y)*.006,-.3,.8);this.drag={id:e.pointerId,x:e.clientX,y:e.clientY}};
  private readonly orbitEnd=(e:PointerEvent)=>{if(this.drag?.id===e.pointerId)this.drag=undefined};
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
      this.scene.remove(this.visual.root,this.visual.debrisRoot);
      for(const root of [this.visual.root,this.visual.debrisRoot])disposeBrazilObject(root);
    }
    if(this.world)this.world.free();
    if(this.queue)this.queue.free();
    this.world=new RAPIER.World({x:0,y:-9.81,z:0});
    this.world.timestep=this.timestep;
    this.queue=new RAPIER.EventQueue(true);
    this.track=buildTrack(this.scene,this.world,this.scenarioId);
    const spec=VEHICLES[this.vehicleId];
    this.visual=createVehicle(spec);this.scene.add(this.visual.root,this.visual.debrisRoot);
    const visual=this.visual;
    this.canvas.dataset.model=spec.modelFile?'loading':'procedural';
    const status=document.getElementById('model-status');
    if(status)status.textContent=spec.modelFile?'Carregando carro detalhado…':'';
    if(spec.modelFile){
      void (spec.id==='concept'?loadConcept():loadBrazilCar(this.vehicleId as BrazilCarId)).then(asset=>{
        if(this.resourceRevision!==revision || visual!==this.visual){disposeBrazilObject(asset);return}
        // The existing Rapier body is centered on the chassis; GLBs use ground-relative Y.
        asset.position.y=-(spec.size[1]*.53+.08);
        // Keep animated wheels; replace only the reserve body with the selected local GLB.
        visual.root.children.forEach(obj=>obj.visible=visual.wheels.includes(obj as THREE.Group));
        asset.traverse(obj=>{if(obj.name.startsWith('wheel_'))obj.visible=false});
        visual.root.add(asset);this.carAsset=asset;
        if(spec.id==='concept')visual.adoptAssetWheels(asset);
        visual.addDamageMeshes(asset);
        this.canvas.dataset.model=spec.id;
        if(status)status.textContent=spec.id==='concept'?'Concept GT · modelo detalhado pronto':'';
      }).catch(error=>{if(this.resourceRevision!==revision)return;this.canvas.dataset.model='fallback';if(status)status.textContent='Falha ao carregar carro detalhado. Reabra a garagem para tentar novamente.';console.warn('Carro: usando modelo de reserva',error)});
    }
    if(this.sceneryId!=='original'){
      void loadBrazilScenery(this.sceneryId as BrazilMapId).then(map=>{
        if(this.resourceRevision!==revision){disposeBrazilObject(map);return}
        this.scenery=map;this.scene.add(map);
      }).catch(error=>console.warn('Paisagem brasileira: usando pista padrão',error));
    }
    this.driving=new VehicleDynamics(RAPIER,this.world,spec);
    this.body=this.driving.body;this.collider=this.driving.collider;
    this.visual.setStructure(this.driving.structure);
    // Settle the springs before showing the parked vehicle.
    for(let i=0;i<120;i++){this.driving.update(EMPTY_INPUT,this.speedLimitKmh);this.world.step()}
    this.queue.drainCollisionEvents(()=>{});
    this.phase='ready';this.controls={left:false,right:false,brake:false,throttle:false};
    this.hitSpeed=0;this.hadAir=false;this.accumulator=0;this.deformationElapsed=0;this.lastBumpIndex=0;
    this.pendingResult=undefined;this.crashReport=undefined;this.orbitYaw=0;this.orbitPitch=0;this.drag=undefined;this.playback=.32;
    this.elapsed=0;this.overturnedTime=0;this.integrity=100;
    const position=this.body.translation();this.visual.root.position.set(position.x,position.y,position.z);
    this.camera.position.set(5,5.5,-12);this.cameraTarget.set(0,position.y,6);
    this.options.onTelemetry({phase:'ready',speed:0,distance:0,integrity:100,progress:0,bumpsPassed:0});
  }
  private readonly resize=()=>{const w=window.innerWidth,h=window.innerHeight;this.renderer.setPixelRatio(this.quality.configure(w,h,window.devicePixelRatio||1));this.renderer.setSize(w,h,false);this.camera.aspect=w/Math.max(1,h);this.camera.fov=w<700?66:55;this.camera.updateProjectionMatrix()};
  private step(){
    if(this.phase==='ready')return;
    const dt=this.timestep;
    const incoming={...this.body.linvel()};
    this.driving.update(this.phase==='running'?this.controls:EMPTY_INPUT,this.speedLimitKmh);
    if(this.phase==='running')this.hitSpeed=kmh(this.driving.speed);
    this.world.step(this.queue);
    this.integrity=100-this.driving.structure.damage;
    if(this.phase==='crashed'){
      if(this.pendingResult){
        this.pendingResult.age+=dt;
        if(this.pendingResult.age>=.35){
          const {avoided,speed}=this.pendingResult,structure=this.driving.structure,damage=structure.damage;
          this.pendingResult=undefined;
          this.crashReport={speed,damage,survival:Math.max(1,100-Math.round(.92*damage**1.08)),avoided,
            scenario:this.scenarioId,bumpsPassed:this.lastBumpIndex,brokenBeams:structure.brokenBeams,
            detachedParts:structure.fragments.length,deformationEnergyKJ:Math.round(structure.plasticWorkJ/1000)};
          this.options.onResult(this.crashReport);
        }
      }
      return;
    }
    if(this.phase==='running'){
      this.elapsed+=dt;
      let impacted=false;
      let normalSpeed=0;
      this.queue.drainCollisionEvents((a,b,started)=>{
        if(!started)return;
        const owned=this.driving.structure.colliderHandles;
        if((owned.has(a)&&this.track.obstacleHandles.has(b))||(owned.has(b)&&this.track.obstacleHandles.has(a))){
          impacted=true;
          // Use closing speed along the surface normal, not full forward speed on a glancing hit.
          this.world.contactPair(this.world.getCollider(a),this.world.getCollider(b),manifold=>{
            const n=manifold.normal();
            normalSpeed=Math.max(normalSpeed,kmh(Math.abs(incoming.x*n.x+incoming.y*n.y+incoming.z*n.z)));
          });
        }
      });
      if(impacted&&normalSpeed>0)this.hitSpeed=normalSpeed;
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
        if(this.integrity<=0){this.finish(false);return}
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
    this.pendingResult={avoided,speed:avoided&&this.scenarioId!=='speedbumps'?0:Math.round(this.hitSpeed),age:0};
  }
  private frame=()=>{
    this.raf=requestAnimationFrame(this.frame);
    const rawDt=this.clock.getDelta();
    const dt=Math.min(.07,rawDt);
    if(document.hidden){this.accumulator=0;return}
    if(this.quality.observe(rawDt*1000))this.renderer.setPixelRatio(this.quality.pixelRatio);
    const timeScale=this.phase==='crashed'?this.playback:1;
    this.accumulator+=dt*timeScale;
    let safety=0;
    while(this.accumulator>=this.timestep&&safety++<10){this.step();this.accumulator-=this.timestep}
    if(safety>=10)this.accumulator=0;
    const t=this.body?.translation();
    if(t&&this.visual){
      this.sun.position.set(t.x-35,t.y+65,t.z+35);this.sun.target.position.set(t.x,t.y,t.z);
      const q=this.body.rotation();
      this.visual.root.position.set(t.x,t.y,t.z);
      this.visual.root.quaternion.set(q.x,q.y,q.z,q.w);
      // Wheels and debris follow every rendered frame. Expensive body skinning runs
      // only at the selected visual rate; Rapier still integrates at 120 Hz.
      this.deformationElapsed+=dt;
      const refreshDeformation=this.deformationElapsed>=this.quality.deformationInterval;
      if(refreshDeformation)this.deformationElapsed=0;
      this.visual.updatePhysics(this.driving,refreshDeformation);
      // Follow the heading with a level horizon; let the chassis visibly pitch and roll.
      this.heading.set(0,0,1).applyQuaternion(this.visual.root.quaternion).setY(0);
      if(this.heading.lengthSq()<.1)this.heading.set(0,0,1);else this.heading.normalize();
      if(this.phase==='crashed')this.heading.applyAxisAngle(new THREE.Vector3(0,1,0),this.orbitYaw);
      const garage=this.phase==='ready';
      const side=garage?5:this.viewMode===0?1.5:10,back=garage?7:this.viewMode===0?11:5;
      this.boxPosition.set(t.x-this.heading.x*back+this.heading.z*side,t.y+4+this.orbitPitch*7,t.z-this.heading.z*back-this.heading.x*side);
      this.camera.position.lerp(this.boxPosition,Math.min(1,dt*3.8));
      const ahead=garage?0:5;
      this.boxPosition.set(t.x+this.heading.x*ahead,t.y+.3,t.z+this.heading.z*ahead);
      this.cameraTarget.lerp(this.boxPosition,1-Math.exp(-6*dt));
      this.camera.lookAt(this.cameraTarget);
      if(performance.now()-this.lastTelemetry>90){
        const speed=kmh(this.phase==='ready'?0:this.driving.speed);
        this.options.onTelemetry({speed:Math.round(speed),distance:Math.max(0,Math.round(t.z)),integrity:this.integrity,phase:this.phase,progress:progressFraction(t.z,this.scenarioId),bumpsPassed:this.lastBumpIndex});
        this.lastTelemetry=performance.now();
      }
    }
    // Frame the parked car in the space above the garage controls.
    const width=window.innerWidth,height=window.innerHeight;
    const available=this.phase==='ready'?Math.max(160,document.querySelector('.bottom-panel')?.getBoundingClientRect().top??height):height;
    const aspect=width/available;
    if(this.camera.aspect!==aspect){this.camera.aspect=aspect;this.camera.updateProjectionMatrix()}
    this.renderer.setViewport(0,height-available,width,available);
    this.renderer.render(this.scene,this.camera);
    this.canvas.dataset.drawCalls=String(this.renderer.info.render.calls);
    this.canvas.dataset.triangles=String(this.renderer.info.render.triangles);
  };
  dispose(){++this.resourceRevision;if(this.scenery){this.scene.remove(this.scenery);disposeBrazilObject(this.scenery)}cancelAnimationFrame(this.raf);window.removeEventListener('resize',this.resize);this.canvas.removeEventListener('pointerdown',this.orbitStart);this.canvas.removeEventListener('pointermove',this.orbitMove);this.canvas.removeEventListener('pointerup',this.orbitEnd);this.canvas.removeEventListener('pointercancel',this.orbitEnd);this.track?.dispose();this.queue?.free();this.world?.free();this.environment.dispose();if(this.visual)for(const root of [this.visual.root,this.visual.debrisRoot])disposeBrazilObject(root);this.renderer.dispose()}
}
