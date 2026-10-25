import * as THREE from 'three';

export type GraphicsProfile='auto'|'eco'|'high'|'ultra';

/** Entirely local procedural material maps: no network textures or additional licenses.
 *  Color and roughness use the same UV repeat so every segment of a long track has detail.
 */
const hash=(x:number,y:number,seed:number)=>{
  let n=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(seed,2246822519))|0;
  n=Math.imul(n^(n>>>13),1274126177);
  return ((n^(n>>>16))>>>0)/4294967295;
};
const smooth=(a:number,b:number,t:number)=>a+(b-a)*t;
function noise(x:number,y:number,seed:number){
  const ax=Math.floor(x),ay=Math.floor(y),dx=x-ax,dy=y-ay;
  const u=dx*dx*(3-2*dx),v=dy*dy*(3-2*dy);
  return smooth(smooth(hash(ax,ay,seed),hash(ax+1,ay,seed),u),
    smooth(hash(ax,ay+1,seed),hash(ax+1,ay+1,seed),u),v);
}
const byte=(value:number)=>Math.round(Math.min(255,Math.max(0,value)));
type SurfaceKind='asphalt'|'gravel'|'grass';
function texture(kind:SurfaceKind,seed:number,roughness=false){
  const side=192,data=new Uint8Array(side*side*4);
  for(let y=0;y<side;y++)for(let x=0;x<side;x++){
    const fine=noise(x*.68,y*.68,seed+4)-.5;
    const medium=noise(x*.095,y*.095,seed)-.5;
    const coarse=noise(x*.027,y*.027,seed+2)-.5;
    const fissure=Math.pow(Math.max(0,.135-Math.abs(Math.sin(x*.069+noise(x*.04,y*.04,seed+10)*3)*Math.cos(y*.033+x*.012))),2)*70;
    const speck=hash(x,y,seed+12);
    const k=(y*side+x)*4;
    if(roughness){
      const r=byte((kind==='asphalt'?226:kind==='gravel'?244:230)+medium*22+fine*15);
      data[k]=data[k+1]=data[k+2]=r;
    }else if(kind==='asphalt'){
      const r=byte(45+medium*31+coarse*21+fine*31+(speck>.985?46:0)-fissure);
      data[k]=r;data[k+1]=byte(r*1.045);data[k+2]=byte(r*1.09);
    }else if(kind==='gravel'){
      const r=byte(91+medium*24+fine*42+(speck>.96?68:0));
      data[k]=byte(r*1.07);data[k+1]=byte(r*1.03);data[k+2]=r;
    }else {
      const r=byte(64+medium*49+coarse*24+fine*36+(speck>.972?31:0));
      data[k]=byte(r*.66);data[k+1]=byte(r*1.28);data[k+2]=byte(r*.65);
    }
    data[k+3]=255;
  }
  const map=new THREE.DataTexture(data,side,side,THREE.RGBAFormat);
  map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.magFilter=THREE.LinearFilter;
  map.minFilter=THREE.LinearMipmapLinearFilter;
  map.generateMipmaps=true;
  map.colorSpace=roughness?THREE.NoColorSpace:THREE.SRGBColorSpace;
  map.anisotropy=4;map.needsUpdate=true;
  return map;
}

export function createSurfaceTextures(trackLength:number,profile:GraphicsProfile='auto'){
  const multiplier=profile==='eco'?1.6:profile==='ultra'?.65:1;
  const roadColor=texture('asphalt',11),roadRoughness=texture('asphalt',11,true);
  const gravelColor=texture('gravel',41),grassColor=texture('grass',71);
  roadColor.repeat.set(2,Math.max(1,trackLength/(8*multiplier)));
  roadRoughness.repeat.copy(roadColor.repeat);
  gravelColor.repeat.set(2,Math.max(1,trackLength/(6*multiplier)));
  grassColor.repeat.set(38,Math.max(1,trackLength/(5*multiplier)));
  const road=new THREE.MeshStandardMaterial({map:roadColor,roughnessMap:roadRoughness,roughness:.94,metalness:.02,color:0xffffff});
  const shoulder=new THREE.MeshStandardMaterial({map:gravelColor,roughness:.98,metalness:0,color:0xffffff});
  const grass=new THREE.MeshStandardMaterial({map:grassColor,roughness:1,metalness:0,color:0xffffff});
  return {road,shoulder,grass,dispose(){
    roadColor.dispose();roadRoughness.dispose();gravelColor.dispose();grassColor.dispose();
    road.dispose();shoulder.dispose();grass.dispose();
  }};
}

/** Rendered behind the terrain as a single shader dome; follows the viewer forever. */
export function createAtmosphere():THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>{
  const material=new THREE.ShaderMaterial({
    side:THREE.BackSide,
    depthWrite:false,depthTest:false,
    uniforms:{top:{value:new THREE.Color(0x456b9e)},horizon:{value:new THREE.Color(0xc8d7df)},sun:{value:new THREE.Color(0xffe2b3)}},
    vertexShader:`
      varying vec3 vSky;
      void main(){
        vSky=position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,
    fragmentShader:`
      varying vec3 vSky;
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 sun;
      void main(){
        vec3 direction=normalize(vSky);
        float t=pow(clamp(direction.y*.7+.28,0.0,1.0),.72);
        vec3 sky=mix(horizon,top,t);
        float glow=pow(max(0.0,dot(direction,normalize(vec3(-.55,.56,.45)))),18.0);
        sky=mix(sky,sun,glow*.36);
        gl_FragColor=vec4(sky,1.0);
      }`
  });
  const sky=new THREE.Mesh(new THREE.SphereGeometry(730,24,12),material);
  sky.name='gamecrash-atmosphere';
  sky.renderOrder=-1000;
  sky.frustumCulled=false;
  return sky;
}

interface Particle {x:number;y:number;z:number;vx:number;vy:number;vz:number;life:number;maxLife:number;spark:boolean}
function radialSprite(){
  const size=32,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const d=Math.hypot((x+.5-size/2)/(size/2),(y+.5-size/2)/(size/2));
    const a=byte(Math.pow(Math.max(0,1-d),1.75)*255),k=(y*size+x)*4;
    data[k]=data[k+1]=data[k+2]=255;data[k+3]=a;
  }
  const tex=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  tex.needsUpdate=true;return tex;
}

/** Bounded impact effects: purely visual, no new bodies, colliders, or draw calls per particle. */
export class ImpactParticles {
  readonly mesh:THREE.Points<THREE.BufferGeometry,THREE.PointsMaterial>;
  private particles:Particle[];
  private cursor=0;
  private readonly sprite=radialSprite();
  constructor(readonly capacity=42){
    this.particles=Array.from({length:capacity},()=>({x:0,y:-100000,z:0,vx:0,vy:0,vz:0,life:0,maxLife:1,spark:false}));
    const geometry=new THREE.BufferGeometry();
    const pos=new Float32Array(capacity*3),colors=new Float32Array(capacity*3);
    for(let i=0;i<capacity;i++){pos[i*3+1]=-100000;colors[i*3]=colors[i*3+1]=colors[i*3+2]=.5}
    geometry.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));
    const material=new THREE.PointsMaterial({size:.8,map:this.sprite,transparent:true,depthWrite:false,vertexColors:true,opacity:.85,sizeAttenuation:true});
    this.mesh=new THREE.Points(geometry,material);
    this.mesh.name='impact-dust-and-sparks';
    this.mesh.frustumCulled=false; // recycled particles move continuously
  }
  get activeCount(){return this.particles.filter(p=>p.life>0).length}
  emit(at:{x:number;y:number;z:number},strength=12){
    const count=Math.min(this.capacity,Math.max(0,Math.ceil(strength)));
    for(let i=0;i<count;i++){
      const index=this.cursor++%this.capacity,angle=hash(index,this.cursor,81)*Math.PI*2;
      const spark=i%6===0,velocity=(spark?7:2.9)*(0.4+hash(index,i,39));
      const maxLife=spark?.35:.85+hash(index,i,31)*.85;
      this.particles[index]={x:at.x,y:at.y+.12,z:at.z,vx:Math.cos(angle)*velocity,vy:(spark?4:1.5)+hash(i,index,29)*2.4,vz:Math.sin(angle)*velocity,life:maxLife,maxLife,spark};
    }
    this.sync();
  }
  update(dt:number){
    if(dt<=0)return;
    for(const p of this.particles)if(p.life>0){
      p.life=Math.max(0,p.life-dt);
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      p.vy-=(p.spark?14:1.7)*dt;
      p.vx*=Math.max(0,1-dt*(p.spark?.6:1.1));p.vz*=Math.max(0,1-dt*(p.spark?.6:1.1));
    }
    this.sync();
  }
  private sync(){
    const positions=this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colors=this.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    for(let i=0;i<this.capacity;i++){
      const p=this.particles[i],fade=p.life>0?Math.min(1,p.life/p.maxLife):0;
      positions.setXYZ(i,p.x,p.life>0?p.y:-100000,p.z);
      if(p.spark)colors.setXYZ(i,1.0*fade,.69*fade,.22*fade);
      else colors.setXYZ(i,.68*fade,.67*fade,.62*fade);
    }
    positions.needsUpdate=true;colors.needsUpdate=true;
  }
  dispose(){this.mesh.geometry.dispose();this.mesh.material.dispose();this.sprite.dispose()}
}
