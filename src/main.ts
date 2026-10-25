import './styles.css';
import {Game,type Result} from './game/Game';
import {SCENARIOS,VEHICLES,SCENERIES,MAX_SPEED_KMH,SPEEDBUMPS,type ScenarioId,type VehicleId,type SceneryId} from './game/rules';

const element=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const $={
  canvas:element<HTMLCanvasElement>('game'),vehicles:element<HTMLDivElement>('vehicles'),scenarios:element<HTMLDivElement>('scenarios'),sceneries:element<HTMLDivElement>('sceneries'),
  start:element<HTMLButtonElement>('start'),retry:element<HTMLButtonElement>('retry'),camera:element<HTMLButtonElement>('camera'),mute:element<HTMLButtonElement>('mute'),
  garage:element<HTMLButtonElement>('garage'),restart:element<HTMLButtonElement>('restart'),graphics:element<HTMLButtonElement>('graphics'),
  inspect:element<HTMLButtonElement>('inspect'),report:element<HTMLButtonElement>('report'),slow:element<HTMLButtonElement>('slow-motion'),
  broken:element<HTMLSpanElement>('broken-beams'),parts:element<HTMLSpanElement>('detached-parts'),energy:element<HTMLSpanElement>('deformation-energy'),
  speed:element<HTMLSpanElement>('speed'),speedBar:element<HTMLSpanElement>('speed-bar'),distance:element<HTMLSpanElement>('distance'),
  integrity:element<HTMLSpanElement>('integrity'),marker:element<HTMLSpanElement>('stage-marker'),
  speedLimit:element<HTMLInputElement>('max-speed'),speedLimitValue:element<HTMLOutputElement>('max-speed-value'),
  bumpsStat:element<HTMLDivElement>('bumps-stat'),bumpsCount:element<HTMLSpanElement>('bumps-count'),
  resultBumps:element<HTMLDivElement>('result-bumps'),resultBumpsCount:element<HTMLSpanElement>('result-bumps-count'),
  result:element<HTMLDivElement>('result-wrap'),resultTitle:element<HTMLHeadingElement>('result-title'),
  survival:element<HTMLSpanElement>('survival'),impactSpeed:element<HTMLSpanElement>('impact-speed'),
  damage:element<HTMLSpanElement>('damage'),controls:element<HTMLDivElement>('drive-controls'),
  loading:element<HTMLDivElement>('loading'),fatal:element<HTMLDivElement>('fatal'),fatalMessage:element<HTMLSpanElement>('fatal-message'),
};
let currentVehicle:VehicleId='concept',currentScenario:ScenarioId='wall',currentScenery:SceneryId='original';
let resultTimer:number|undefined;
let soundEnabled=false;
let lastPhase='ready';
let lastResult:Result|undefined;
let playbackIndex=0;
const playback=[.32,1,.1,0];
const game=new Game($.canvas,{
  onTelemetry(value){
    $.speed.textContent=Math.round(value.speed).toString().padStart(3,'0');
    $.speedBar.style.width=`${Math.round(Math.min(100,value.speed/Number($.speedLimit.value)*100))}%`;
    $.bumpsCount.textContent=`${String(value.bumpsPassed).padStart(3,'0')}/${SPEEDBUMPS.count}`;
    $.distance.textContent=`${String(value.distance).padStart(3,'0')} m`;
    $.integrity.textContent=`${value.integrity}%`;
    if(value.phase!==lastPhase){lastPhase=value.phase;document.body.dataset.phase=value.phase}
    $.marker.innerHTML=value.phase==='ready'?'<span class="stage-dot"></span> SELECIONE UM TESTE E COMECE':value.phase==='running'?`<span class="stage-dot pulse"></span> ${SCENARIOS[currentScenario].label} · ${Math.round(value.progress*100)}% DA PISTA`:'<span class="stage-dot"></span> SIMULAÇÃO CONCLUÍDA';
    if(value.phase==='running')$.start.innerHTML='<span>REINICIAR TESTE</span><b>↻</b>';
    if(value.phase==='ready')$.start.innerHTML='<span>INICIAR TESTE</span><b>↗</b>';
  },
  onResult(result){if(resultTimer)clearTimeout(resultTimer);if(soundEnabled)playImpact(result.damage);
    lastResult=result;$.report.disabled=false;
    resultTimer=window.setTimeout(()=>showResult(result),1000);
  }
});
function showResult(result:Result){
  if(resultTimer)clearTimeout(resultTimer);resultTimer=undefined;
  $.resultTitle.textContent=result.scenario==='speedbumps'?(result.avoided?'120 LOMBADAS SUPERADAS':'DESAFIO INTERROMPIDO'):(result.avoided?'OBSTÁCULO EVITADO':'TESTE CONCLUÍDO');
  $.resultBumps.classList.toggle('hidden',result.scenario!=='speedbumps');
  $.resultBumpsCount.textContent=`${result.bumpsPassed}/${SPEEDBUMPS.count}`;
  $.survival.textContent=String(result.survival).padStart(2,'0');
  $.impactSpeed.textContent=result.scenario==='speedbumps'?`${result.speed} KM/H`:(result.avoided?'SEM IMPACTO':`${result.speed} KM/H`);
  $.damage.textContent=`${result.damage}%`;
  $.broken.textContent=String(result.brokenBeams);$.parts.textContent=String(result.detachedParts);$.energy.textContent=`${result.deformationEnergyKJ} kJ`;
  $.result.classList.remove('hidden');
}
function updateSelectors(){
  for(const btn of $.vehicles.querySelectorAll('button'))btn.classList.toggle('selected',btn.dataset.vehicle===currentVehicle);
  for(const btn of $.scenarios.querySelectorAll('button'))btn.classList.toggle('selected',btn.dataset.scenario===currentScenario);
  for(const btn of $.sceneries.querySelectorAll('button'))btn.classList.toggle('selected',btn.dataset.scenery===currentScenery);
  $.bumpsStat.classList.toggle('hidden',currentScenario!=='speedbumps');
}
function hideResult(){if(resultTimer)clearTimeout(resultTimer);lastResult=undefined;$.report.disabled=true;$.result.classList.add('hidden')}
function buildSelectors(){
  for(const [id,v] of Object.entries(VEHICLES)){
    const b=document.createElement('button');b.className='pick vehicle';b.type='button';b.dataset.vehicle=id;
    const color='#'+v.color.toString(16).padStart(6,'0');
    b.innerHTML=`<span class="car-icon"><svg viewBox="0 0 100 44" role="img" aria-label="Carro estilizado"><path d="M7 25 18 20 30 6 Q34 2 42 2 H70 Q78 2 83 8 L91 20 96 24 97 36 H4 V30 Q4 27 7 25Z" fill="${color}"/><path d="M30 20 40 7 H69 Q74 7 79 14 L83 20Z" fill="#18212c"/><circle cx="27" cy="35" r="8" fill="#0c111b" stroke="#9aa5b1" stroke-width="3"/><circle cx="76" cy="35" r="8" fill="#0c111b" stroke="#9aa5b1" stroke-width="3"/></svg></span><span class="pick-text"><b>${v.name}</b><small>${v.kind}</small></span><span class="radio-dot"></span>`;
    b.addEventListener('click',()=>{hideResult();currentVehicle=id as VehicleId;game.selectVehicle(currentVehicle);updateSelectors()});$.vehicles.append(b);
  }
  for(const [id,s] of Object.entries(SCENARIOS)){
    const b=document.createElement('button');b.type='button';b.className='pick scenario';b.dataset.scenario=id;
    b.innerHTML=`<span class="scenario-glyph">${s.icon}</span><span class="pick-text"><b>${s.label}</b><small>${s.subtitle}</small></span><span class="radio-dot"></span>`;
    b.addEventListener('click',()=>{hideResult();currentScenario=id as ScenarioId;game.selectScenario(currentScenario);updateSelectors()});$.scenarios.append(b);
  }
  for(const [id,s] of Object.entries(SCENERIES)){
    const b=document.createElement('button');b.type='button';b.className='pick scenery';b.dataset.scenery=id;
    const name=document.createElement('span');name.className='pick-text';
    const strong=document.createElement('b');strong.textContent=s.label;
    name.append(strong);b.append(name);
    b.addEventListener('click',()=>{hideResult();currentScenery=id as SceneryId;game.selectScenery(currentScenery);updateSelectors()});
    $.sceneries.append(b);
  }
  updateSelectors();
}
let audio:AudioContext|undefined;
function playImpact(damage:number){try{
  audio??=new AudioContext();void audio.resume();
  const osc=audio.createOscillator();const gain=audio.createGain();const now=audio.currentTime;
  osc.type='sawtooth';osc.frequency.setValueAtTime(100,now);osc.frequency.exponentialRampToValueAtTime(30,now+.42);
  gain.gain.setValueAtTime(Math.min(.11,.035+damage*.00065),now);gain.gain.exponentialRampToValueAtTime(.001,now+.45);
  osc.connect(gain).connect(audio.destination);osc.start(now);osc.stop(now+.45);
}catch{/* Sound is optional and the simulation continues without audio. */}}
const touchInputs=new Map<number,'left'|'right'|'brake'|'throttle'>();
function bindHolding(id:string,key:'left'|'right'|'brake'|'throttle'){
  const btn=element<HTMLButtonElement>(id);
  btn.addEventListener('pointerdown',e=>{
    e.preventDefault();
    if(game.phaseState!=='running')start();
    // Synthetic pointer events used by QA do not own a browser pointer to capture.
    try{btn.setPointerCapture(e.pointerId)}catch{/* No active pointer to capture. */}
    touchInputs.set(e.pointerId,key);syncKeys();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(type,e=>{touchInputs.delete((e as PointerEvent).pointerId);syncKeys()});
}
const keys=new Set<string>();
function syncKeys(){
  const touches=new Set(touchInputs.values());
  const controls={left:touches.has('left')||keys.has('a')||keys.has('arrowleft'),right:touches.has('right')||keys.has('d')||keys.has('arrowright'),brake:touches.has('brake')||keys.has('s')||keys.has('arrowdown')||keys.has(' '),throttle:touches.has('throttle')||keys.has('w')||keys.has('arrowup')};
  game.setControls(controls);
  for(const [id,key] of [['left','left'],['right','right'],['brake','brake'],['accelerate','throttle']] as const)element<HTMLButtonElement>(id).classList.toggle('pressed',controls[key]);
  element<HTMLButtonElement>('accelerate').setAttribute('aria-pressed',String(controls.throttle));
}
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;const key=e.key.toLowerCase();if(['arrowleft','arrowright','arrowup','arrowdown',' '].includes(key))e.preventDefault();keys.add(key);if((key==='w'||key==='arrowup')&&game.phaseState==='ready')start();syncKeys()});
window.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());syncKeys()});
function releaseInputs(){keys.clear();touchInputs.clear();syncKeys()}
window.addEventListener('blur',releaseInputs);
document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseInputs()});
function start(){hideResult();touchInputs.clear();playbackIndex=0;$.slow.textContent='0,32×';game.start();syncKeys()}
$.start.addEventListener('click',start);
$.retry.addEventListener('click',start);
$.restart.addEventListener('click',()=>{releaseInputs();start()});
$.garage.addEventListener('click',()=>{hideResult();releaseInputs();game.returnToGarage()});
$.inspect.addEventListener('click',()=>{$.result.classList.add('hidden');$.canvas.focus()});
$.report.addEventListener('click',()=>{const result=game.resultSnapshot()??lastResult;if(result)showResult(result)});
$.slow.addEventListener('click',()=>{playbackIndex=(playbackIndex+1)%playback.length;const value=playback[playbackIndex];game.setImpactPlayback(value);$.slow.textContent=value===0?'PAUSADO':`${String(value).replace('.',',')}×`});
const graphicsProfiles=['auto','eco','high','ultra'] as const;
const graphicsLabels={auto:'AUTO',eco:'ECO',high:'ALTO',ultra:'ULTRA'} as const;
let graphicProfileIndex=0;
$.graphics.addEventListener('click',()=>{
  graphicProfileIndex=(graphicProfileIndex+1)%graphicsProfiles.length;
  const profile=graphicsProfiles[graphicProfileIndex];
  game.setGraphicsProfile(profile);
  $.graphics.textContent=graphicsLabels[profile];
  $.graphics.setAttribute('aria-label','Qualidade gráfica: '+graphicsLabels[profile]);
  $.graphics.setAttribute('aria-pressed',String(profile!=='auto'));
});
$.camera.addEventListener('click',()=>game.toggleCamera());
$.mute.addEventListener('click',()=>{soundEnabled=!soundEnabled;$.mute.classList.toggle('active',soundEnabled);$.mute.title=soundEnabled?'Desativar som':'Ativar som'});
$.speedLimit.max=String(MAX_SPEED_KMH);
$.speedLimit.addEventListener('input',()=>{$.speedLimitValue.value=`${$.speedLimit.value} KM/H`;game.setSpeedLimitKmh(Number($.speedLimit.value))});
for(const id of ['left','right','brake','accelerate'] as const)bindHolding(id,id==='accelerate'?'throttle':id);
buildSelectors();
void game.init().then(()=>{$.loading.classList.add('hidden');document.body.dataset.phase='ready'}).catch(error=>{
  $.loading.classList.add('hidden');$.fatal.classList.remove('hidden');
  $.fatalMessage.textContent=error instanceof Error?error.message:'Verifique suporte a WebGL e recarregue a página.';
  console.error('GameCrash initialization error',error);
});
