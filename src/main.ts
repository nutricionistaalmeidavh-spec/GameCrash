import './styles.css';
import {Game,type Result} from './game/Game';
import {SCENARIOS,VEHICLES,type ScenarioId,type VehicleId} from './game/rules';

const element=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const $={
  canvas:element<HTMLCanvasElement>('game'),vehicles:element<HTMLDivElement>('vehicles'),scenarios:element<HTMLDivElement>('scenarios'),
  start:element<HTMLButtonElement>('start'),retry:element<HTMLButtonElement>('retry'),camera:element<HTMLButtonElement>('camera'),mute:element<HTMLButtonElement>('mute'),
  speed:element<HTMLSpanElement>('speed'),speedBar:element<HTMLSpanElement>('speed-bar'),distance:element<HTMLSpanElement>('distance'),
  integrity:element<HTMLSpanElement>('integrity'),marker:element<HTMLSpanElement>('stage-marker'),
  result:element<HTMLDivElement>('result-wrap'),resultTitle:element<HTMLHeadingElement>('result-title'),
  survival:element<HTMLSpanElement>('survival'),impactSpeed:element<HTMLSpanElement>('impact-speed'),
  damage:element<HTMLSpanElement>('damage'),controls:element<HTMLDivElement>('drive-controls'),
  loading:element<HTMLDivElement>('loading'),fatal:element<HTMLDivElement>('fatal'),fatalMessage:element<HTMLSpanElement>('fatal-message'),
};
let currentVehicle:VehicleId='sedan',currentScenario:ScenarioId='wall';
let resultTimer:number|undefined;
let soundEnabled=false;
let lastPhase='ready';
const game=new Game($.canvas,{
  onTelemetry(value){
    $.speed.textContent=Math.round(value.speed).toString().padStart(3,'0');
    $.speedBar.style.width=`${Math.round(Math.min(100,value.speed/250*100))}%`;
    $.distance.textContent=`${String(value.distance).padStart(3,'0')} m`;
    $.integrity.textContent=`${value.integrity}%`;
    if(value.phase!==lastPhase){lastPhase=value.phase;document.body.dataset.phase=value.phase}
    $.marker.innerHTML=value.phase==='ready'?'<span class="stage-dot"></span> SELECIONE UM TESTE E COMECE':value.phase==='running'?`<span class="stage-dot pulse"></span> ${SCENARIOS[currentScenario].label} · ${Math.round(value.progress*100)}% DA PISTA`:'<span class="stage-dot"></span> SIMULAÇÃO CONCLUÍDA';
    if(value.phase==='running')$.start.innerHTML='<span>REINICIAR TESTE</span><b>↻</b>';
    if(value.phase==='ready')$.start.innerHTML='<span>INICIAR TESTE</span><b>↗</b>';
  },
  onResult(result){if(resultTimer)clearTimeout(resultTimer);if(soundEnabled)playImpact(result.damage);
    resultTimer=window.setTimeout(()=>showResult(result),1000);
  }
});
function showResult(result:Result){
  $.resultTitle.textContent=result.avoided?'OBSTÁCULO EVITADO':'TESTE CONCLUÍDO';
  $.survival.textContent=String(result.survival).padStart(2,'0');
  $.impactSpeed.textContent=result.avoided?'SEM IMPACTO':`${result.speed} KM/H`;
  $.damage.textContent=result.avoided?'0%':`${result.damage}%`;
  $.result.classList.remove('hidden');
}
function updateSelectors(){
  for(const btn of $.vehicles.querySelectorAll('button'))btn.classList.toggle('selected',btn.dataset.vehicle===currentVehicle);
  for(const btn of $.scenarios.querySelectorAll('button'))btn.classList.toggle('selected',btn.dataset.scenario===currentScenario);
}
function hideResult(){if(resultTimer)clearTimeout(resultTimer);$.result.classList.add('hidden')}
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
function bindHolding(id:string,key:'left'|'right'|'brake'|'throttle'){
  const btn=element<HTMLButtonElement>(id);
  const set=(on:boolean)=>{
    game.setControls({[key]:on});
    btn.classList.toggle('pressed',on);
    if(key==='throttle')btn.setAttribute('aria-pressed',String(on));
  };
  btn.addEventListener('pointerdown',e=>{
    e.preventDefault();
    if(game.phaseState!=='running')return;
    // Synthetic pointer events used by QA do not own a browser pointer to capture.
    try{btn.setPointerCapture(e.pointerId)}catch{/* No active pointer to capture. */}
    set(true);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(type,()=>set(false));
}
const keys=new Set<string>();
function syncKeys(){game.setControls({left:keys.has('a')||keys.has('arrowleft'),right:keys.has('d')||keys.has('arrowright'),brake:keys.has('s')||keys.has('arrowdown')||keys.has(' '),throttle:keys.has('w')||keys.has('arrowup')});}
window.addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(['arrowleft','arrowright','arrowup','arrowdown',' '].includes(key))e.preventDefault();keys.add(key);syncKeys();if((key==='w'||key==='arrowup')&&game.phaseState==='ready')start()});
window.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());syncKeys()});
window.addEventListener('blur',()=>{keys.clear();syncKeys();game.setControls({left:false,right:false,brake:false,throttle:false})});
function start(){hideResult();game.start();syncKeys();document.querySelectorAll('.drive-btn').forEach(button=>button.classList.remove('pressed'));element<HTMLButtonElement>('accelerate').setAttribute('aria-pressed','false')}
$.start.addEventListener('click',start);
$.retry.addEventListener('click',start);
$.camera.addEventListener('click',()=>game.toggleCamera());
$.mute.addEventListener('click',()=>{soundEnabled=!soundEnabled;$.mute.classList.toggle('active',soundEnabled);$.mute.title=soundEnabled?'Desativar som':'Ativar som'});
for(const id of ['left','right','brake','accelerate'] as const)bindHolding(id,id==='accelerate'?'throttle':id);
buildSelectors();
void game.init().then(()=>{$.loading.classList.add('hidden');document.body.dataset.phase='ready'}).catch(error=>{
  $.loading.classList.add('hidden');$.fatal.classList.remove('hidden');
  $.fatalMessage.textContent=error instanceof Error?error.message:'Verifique suporte a WebGL e recarregue a página.';
  console.error('GameCrash initialization error',error);
});
