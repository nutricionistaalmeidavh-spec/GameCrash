import * as THREE from 'three';
import {loadEngines,createRapier,createJolt,HALF} from './engines.mjs';
import {SCENARIOS,SAMPLE_STEPS,exportBenchmark} from './scenarios.mjs';

const $=id=>document.getElementById(id);
const canvas=$('canvas'),status=$('status'),runButton=$('run'),compareButton=$('compare'),exportButton=$('export');
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x172338);
scene.fog=new THREE.Fog(0x172338,30,80);
const camera=new THREE.PerspectiveCamera(52,2,.1,150);
camera.position.set(8,7,-17);
camera.lookAt(0,1,-4);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
scene.add(new THREE.HemisphereLight(0xeff7ff,0x344155,2));
const sunlight=new THREE.DirectionalLight(0xffffff,2.2);
sunlight.position.set(-8,14,-5);scene.add(sunlight);
const ground=new THREE.Mesh(new THREE.BoxGeometry(30,1,120),new THREE.MeshStandardMaterial({color:0x344254,roughness:1}));
ground.position.set(0,-.5,0);scene.add(ground);
let obstacles=[],carGeometry=null,carWire=null,currentPoints=[],reports=[],active=false;
const material=new THREE.MeshStandardMaterial({color:0xffbd72,metalness:.3,roughness:.62});
function box(x,y,z,sx,sy,sz,rot=0) {
  const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);
  m.position.set(x,y,z);m.rotation.x=rot;scene.add(m);obstacles.push(m);
}
function drawScenario(name) {
  for(const m of obstacles){scene.remove(m);m.geometry.dispose()}
  obstacles=[];
  if(name==='wall')box(0,2,0,6,4,.7);
  if(name==='ramp')box(0,.35,-1,4,.6,6,.28);
  if(name==='bumps')for(let z=-4;z<=4;z+=2)box(0,.12,z,4,.24,.64);
}
function linksFor(points){
  const edges=[];
  if(points.length===8){
    for(let i=0;i<8;i++)for(const mask of [1,2,4])if((i&mask)===0)edges.push([i,i|mask]);
  } else {
    for(let z=0;z<6;z++)for(let y=0;y<2;y++)for(let x=0;x<3;x++){
      const i=x+3*(y+2*z);
      if(x<2)edges.push([i,i+1]);
      if(y<1)edges.push([i,i+3]);
      if(z<5)edges.push([i,i+6]);
    }
  }
  return edges;
}
function drawCar(points){
  if(!points.length)return;
  if(carWire){scene.remove(carWire);carGeometry.dispose()}
  currentPoints=points;
  const vertices=[],edges=linksFor(points);
  for(const [a,b] of edges){vertices.push(...points[a],...points[b])}
  carGeometry=new THREE.BufferGeometry();
  carGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  carWire=new THREE.LineSegments(carGeometry,new THREE.LineBasicMaterial({color:points.length===8?0x66caff:0xff997b}));
  scene.add(carWire);
}
function render(){
  const w=canvas.clientWidth||360,h=canvas.clientHeight||280;
  const rw=Math.round(w*Math.min(devicePixelRatio||1,1.5)),rh=Math.round(h*Math.min(devicePixelRatio||1,1.5));
  if(canvas.width!==rw||canvas.height!==rh){
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  renderer.render(scene,camera);
}
function renderLoop(){render();requestAnimationFrame(renderLoop)}
requestAnimationFrame(renderLoop);
drawScenario('wall');
function setBusy(busy){
  active=busy;
  runButton.disabled=compareButton.disabled=$('engine').disabled=$('scenario').disabled=busy;
  exportButton.disabled=busy||reports.length===0;
}
function setStats(report) {
  $('engine-name').textContent=report.engine;
  $('duration').textContent=report.metrics.totalMs.toFixed(1)+' ms';
  $('p95').textContent=report.metrics.p95StepMs.toFixed(2)+' ms';
  $('deformation').textContent=report.observations.maxCompressionPercent.toFixed(1)+' %';
  $('distance').textContent=report.observations.distance.toFixed(1)+' m';
}
async function execute(engine,scenario) {
  const sim=engine==='jolt'?createJolt(scenario):createRapier(scenario);
  const samples=[];
  try{
    for(let i=0;i<SAMPLE_STEPS;i++){
      const t=performance.now();
      sim.step();
      samples.push(performance.now()-t);
      if(i%8===0&&sim.sample)sim.sample();
      if(i%2===0){drawCar(sim.points());status.textContent=engine+' · '+SCENARIOS[scenario].label+' · '+Math.round(i/SAMPLE_STEPS*100)+'%';await new Promise(requestAnimationFrame)}
    }
    sim.sample?.();
    drawCar(sim.points());
    const report=exportBenchmark(sim.engine,scenario,samples,sim.snapshot());
    setStats(report);
    return report;
  }finally{sim.dispose()}
}
async function start(mode){
  if(active)return;
  reports=[];setBusy(true);
  const scenario=$('scenario').value;
  drawScenario(scenario);
  try{
    for(const engine of mode==='compare'?['rapier','jolt']:[$('engine').value]){
      const r=await execute(engine,scenario);reports.push(r);
      $('results').textContent=JSON.stringify(reports,null,2);
    }
    status.textContent='Benchmark concluído. Modelo rígido e soft-body não possuem métrica de dano diretamente equivalente.';
  }catch(error){
    console.error(error);
    status.textContent='Falha experimental: '+(error?.message||String(error));
    $('results').textContent='Não foi possível validar este motor. Nenhum resultado fictício foi gerado.';
  }finally{setBusy(false)}
}
runButton.addEventListener('click',()=>start('single'));
compareButton.addEventListener('click',()=>start('compare'));
$('scenario').addEventListener('change',e=>{drawScenario(e.target.value);drawCar([])});
exportButton.addEventListener('click',()=>{
  if(!reports.length)return;
  const blob=new Blob([JSON.stringify(reports,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='gamecrash-physics-benchmark.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),500);
});
loadEngines().then(()=>{
  status.textContent='Rapier e Jolt WASM carregados. Pronto para medir.';
  runButton.disabled=false;compareButton.disabled=false;
}).catch(error=>{
  console.error(error);setBusy(true);
  status.textContent='Falha ao inicializar WASM: '+(error?.message||String(error));
});
