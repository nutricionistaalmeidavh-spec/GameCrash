import * as RAPIER from '@dimforge/rapier3d-compat';
import initJolt from 'jolt-physics/wasm-compat';
import {SCENARIOS,PHYSICS_STEP} from './scenarios.mjs';

const MASS=1200;
const HALF={x:.85,y:.55,z:1.95};
const JOLT_NONMOVING=0, JOLT_MOVING=1;
let JoltModule=null;

export async function loadEngines() {
  await RAPIER.init();
  JoltModule=await initJolt();
}
function setupRapierObstacles(world,scenario) {
  const add=(x,y,z,hx,hy,hz,angle=0)=>{
    const body=world.createRigidBody(RAPIER.RigidBodyDesc.fixed()
      .setTranslation(x,y,z).setRotation({x:Math.sin(angle/2),y:0,z:0,w:Math.cos(angle/2)}));
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz).setFriction(.85),body);
  };
  add(0,-.5,0,15,.5,60);
  if(scenario==='wall')add(0,2,0,3,2,.35);
  if(scenario==='ramp')add(0,.35,-1,2,.3,3,.28);
  if(scenario==='bumps')for(let z=-4;z<=4;z+=2)add(0,.12,z,2,.12,.32);
}
export function createRapier(scenarioName) {
  const s=SCENARIOS[scenarioName], world=new RAPIER.World({x:0,y:-9.81,z:0});
  world.timestep=PHYSICS_STEP;
  setupRapierObstacles(world,scenarioName);
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(0,s.height,-s.initialDistance)
    .setLinvel(0,0,s.initialKmh/3.6).setCcdEnabled(true)
    .setLinearDamping(.01));
  world.createCollider(RAPIER.ColliderDesc.cuboid(HALF.x,HALF.y,HALF.z)
    .setMass(MASS).setFriction(.75).setRestitution(0),body);
  const start=body.translation().z;
  return {
    engine:'Rapier',
    step(){world.step()},
    points(){
      const p=body.translation(),q=body.rotation();
      // Rigid visualization: cuboid vertices with actual body orientation
      const v=[];
      for(const x of [-HALF.x,HALF.x])for(const y of [-HALF.y,HALF.y])for(const z of [-HALF.z,HALF.z]){
        const a={x:2*(q.y*z-q.z*y),y:2*(q.z*x-q.x*z),z:2*(q.x*y-q.y*x)};
        v.push([p.x+x+q.w*a.x+(q.y*a.z-q.z*a.y),
          p.y+y+q.w*a.y+(q.z*a.x-q.x*a.z),
          p.z+z+q.w*a.z+(q.x*a.y-q.y*a.x)]);
      }
      return v;
    },
    snapshot(){const p=body.translation(),v=body.linvel();return {
      distance:Math.round((p.z-start)*100)/100,remainingSpeedKmh:Math.round(Math.hypot(v.x,v.y,v.z)*3.6),
      maxCompressionPercent:0,measuredModel:'rigid reference'
    }},
    dispose(){world.free()}
  };
}
function makeJoltPhysics(J) {
  const settings=new J.JoltSettings();
  settings.mMaxWorkerThreads=0;
  const pair=new J.ObjectLayerPairFilterTable(2);
  pair.EnableCollision(JOLT_NONMOVING,JOLT_MOVING);
  pair.EnableCollision(JOLT_MOVING,JOLT_MOVING);
  const bp=new J.BroadPhaseLayerInterfaceTable(2,2);
  bp.MapObjectToBroadPhaseLayer(0,new J.BroadPhaseLayer(0));
  bp.MapObjectToBroadPhaseLayer(1,new J.BroadPhaseLayer(1));
  settings.mObjectLayerPairFilter=pair;
  settings.mBroadPhaseLayerInterface=bp;
  settings.mObjectVsBroadPhaseLayerFilter=new J.ObjectVsBroadPhaseLayerFilterTable(bp,2,pair,2);
  const iface=new J.JoltInterface(settings);
  J.destroy(settings);
  return {iface,bodies:iface.GetPhysicsSystem().GetBodyInterface()};
}
function addJoltBox(J,bodies,x,y,z,hx,hy,hz,angle=0) {
  const shape=new J.BoxShape(new J.Vec3(hx,hy,hz),.05,null);
  const q=angle?J.Quat.prototype.sRotation(new J.Vec3(1,0,0),angle):J.Quat.prototype.sIdentity();
  const settings=new J.BodyCreationSettings(shape,new J.RVec3(x,y,z),q,J.EMotionType_Static,JOLT_NONMOVING);
  const body=bodies.CreateBody(settings);
  bodies.AddBody(body.GetID(),J.EActivation_Activate);
  J.destroy(settings);
}
function setupJoltObstacles(J,bodies,scenario) {
  const add=(...args)=>addJoltBox(J,bodies,...args);
  add(0,-.5,0,15,.5,60);
  if(scenario==='wall')add(0,2,0,3,2,.35);
  if(scenario==='ramp')add(0,.35,-1,2,.3,3,.28);
  if(scenario==='bumps')for(let z=-4;z<=4;z+=2)add(0,.12,z,2,.12,.32);
}
/** Experimental longitudinal vehicle-shaped soft cage, not a complete vehicle. */
function createJoltCage(J,s) {
  const nx=3,ny=2,nz=6,N=nx*ny*nz;
  const ix=(x,y,z)=>x+nx*(y+ny*z);
  const shared=new J.SoftBodySharedSettings();
  const vertex=new J.SoftBodySharedSettingsVertex();
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    vertex.mPosition.x=(x/(nx-1)*2-1)*HALF.x;
    vertex.mPosition.y=(y/(ny-1)*2-1)*HALF.y;
    vertex.mPosition.z=(z/(nz-1)*2-1)*HALF.z;
    vertex.mInvMass=N/MASS;
    vertex.mVelocity.z=s.initialKmh/3.6;
    shared.mVertices.push_back(vertex);
  }
  J.destroy(vertex);
  const edges=[];
  const edge=new J.SoftBodySharedSettingsEdge(0,0,0);
  edge.mCompliance=0.000008;
  const seen=new Set();
  const addEdge=(a,b)=>{
    if(a===b)return;
    const key=[a,b].sort((x,y)=>x-y).join(':');if(seen.has(key))return;seen.add(key);
    edge.set_mVertex(0,a);edge.set_mVertex(1,b);
    shared.mEdgeConstraints.push_back(edge);edges.push([a,b]);
  };
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const a=ix(x,y,z);
    if(x+1<nx)addEdge(a,ix(x+1,y,z));
    if(y+1<ny)addEdge(a,ix(x,y+1,z));
    if(z+1<nz)addEdge(a,ix(x,y,z+1));
    if(x+1<nx&&z+1<nz)addEdge(a,ix(x+1,y,z+1));
    if(x+1<nx&&y+1<ny)addEdge(a,ix(x+1,y+1,z));
    if(y+1<ny&&z+1<nz)addEdge(a,ix(x,y+1,z+1));
  }
  J.destroy(edge);
  shared.CalculateEdgeLengths();
  const face=new J.SoftBodySharedSettingsFace(0,0,0,0);
  const triangle=(a,b,c)=>{face.set_mVertex(0,a);face.set_mVertex(1,b);face.set_mVertex(2,c);shared.AddFace(face)};
  const quad=(a,b,c,d)=>{triangle(a,b,c);triangle(a,c,d)};
  for(let z=0;z<nz-1;z++)for(let x=0;x<nx-1;x++){
    quad(ix(x,0,z),ix(x+1,0,z),ix(x+1,0,z+1),ix(x,0,z+1));
    quad(ix(x,ny-1,z+1),ix(x+1,ny-1,z+1),ix(x+1,ny-1,z),ix(x,ny-1,z));
  }
  for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++){
    quad(ix(0,y,z+1),ix(0,y+1,z+1),ix(0,y+1,z),ix(0,y,z));
    quad(ix(nx-1,y,z),ix(nx-1,y+1,z),ix(nx-1,y+1,z+1),ix(nx-1,y,z+1));
  }
  for(let x=0;x<nx-1;x++)for(let y=0;y<ny-1;y++){
    quad(ix(x,y,0),ix(x,y+1,0),ix(x+1,y+1,0),ix(x+1,y,0));
    quad(ix(x+1,y,nz-1),ix(x+1,y+1,nz-1),ix(x,y+1,nz-1),ix(x,y,nz-1));
  }
  J.destroy(face);
  shared.Optimize();
  return {shared,edges};
}
export function createJolt(scenarioName) {
  if(!JoltModule)throw Error('Jolt WASM not initialized');
  const J=JoltModule,s=SCENARIOS[scenarioName];
  const {iface,bodies}=makeJoltPhysics(J);
  setupJoltObstacles(J,bodies,scenarioName);
  const {shared,edges}=createJoltCage(J,s);
  const creation=new J.SoftBodyCreationSettings(shared,
    new J.RVec3(0,s.height,-s.initialDistance),J.Quat.prototype.sIdentity(),JOLT_MOVING);
  creation.mGravityFactor=1;
  creation.mFriction=.75;
  const body=bodies.CreateSoftBody(creation);
  bodies.AddBody(body.GetID(),J.EActivation_Activate);
  J.destroy(creation);
  const initialZ=-s.initialDistance;
  let maxCompression=0;
  const points=()=>{
    const vertices=J.castObject(body.GetMotionProperties(),J.SoftBodyMotionProperties).GetVertices();
    const transform=body.GetWorldTransform(),origin=transform.GetTranslation();
    const out=[];
    for(let i=0;i<vertices.size();i++){
      const rel=transform.Multiply3x3(vertices.at(i).mPosition);
      out.push([rel.GetX()+origin.GetX(),rel.GetY()+origin.GetY(),rel.GetZ()+origin.GetZ()]);
      J.destroy(rel);
    }
    return out;
  };
  return {
    engine:'Jolt',
    step(){iface.Step(PHYSICS_STEP,1)},
    points,
    sample(){
      const p=points();
      const depth=Math.max(...p.map(x=>x[2]))-Math.min(...p.map(x=>x[2]));
      maxCompression=Math.max(maxCompression,Math.max(0,(2*HALF.z-depth)/(2*HALF.z))*100);
    },
    snapshot(){
      const p=points();const z=p.reduce((sum,x)=>sum+x[2],0)/p.length;
      return {distance:Math.round((z-initialZ)*100)/100,
        maxCompressionPercent:Math.round(maxCompression*100)/100,
        measuredModel:'elastic soft-body proxy (not plastic damage)',nodes:p.length,edges:edges.length};
    },
    dispose(){bodies.RemoveBody(body.GetID());bodies.DestroyBody(body.GetID());J.destroy(iface)}
  };
}
export {MASS,HALF};
