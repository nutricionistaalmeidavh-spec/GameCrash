import './style.css';
import { Game, type Telemetry, type Result } from './game/Game';
import { VEHICLES, SCENARIOS, type VehicleId, type ScenarioId } from './game/rules';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element: ${id}`);
  return found as T;
}
const canvas = element<HTMLCanvasElement>('game');
const speed = element('speed');
const speedBar = element('speed-bar');
const distance = element('distance');
const integrity = element('integrity');
const marker = element('stage-marker');
const startBtn = element<HTMLButtonElement>('start');
const results = element('result-wrap');
const vehicleWrap = element('vehicles');
const scenarioWrap = element('scenarios');
const driveControls = element('drive-controls');
const hint = element('hint');
let car: VehicleId = 'sedan';
let challenge: ScenarioId = 'wall';
let game: Game;
let muted = true;
let sound: AudioContext | undefined;
let soundStarted = false;

function renderChoices() {
  vehicleWrap.replaceChildren();
  for (const spec of Object.values(VEHICLES)) {
    const btn = document.createElement('button');
    btn.className = `choice vehicle-choice ${spec.id === car ? 'selected' : ''}`;
    btn.setAttribute('aria-pressed', String(spec.id === car));
    btn.innerHTML = `<span class="car-icon">${spec.id === 'suv' ? '▰' : spec.id === 'hatch' ? '▱' : '▰'}</span><span><strong>${spec.name}</strong><small>${spec.kind}</small></span>`;
    btn.addEventListener('click', () => { car = spec.id; game.selectVehicle(car); closeResults(); renderChoices(); });
    vehicleWrap.append(btn);
  }
  scenarioWrap.replaceChildren();
  for (const spec of Object.values(SCENARIOS)) {
    const btn = document.createElement('button');
    btn.className = `choice scenario-choice ${spec.id === challenge ? 'selected' : ''}`;
    btn.setAttribute('aria-pressed', String(spec.id === challenge));
    btn.innerHTML = `<span class="scenario-icon">${spec.icon}</span><span><strong>${spec.label}</strong><small>${spec.subtitle}</small></span>`;
    btn.addEventListener('click', () => { challenge = spec.id; game.selectScenario(challenge); closeResults(); renderChoices(); });
    scenarioWrap.append(btn);
  }
}

function showTelemetry(t: Telemetry) {
  speed.textContent = Math.round(t.speed).toString().padStart(3, '0');
  speedBar.style.width = `${Math.min(100, Math.round(t.speed / VEHICLES[car].maxSpeed * 100))}%`;
  distance.textContent = `${t.distance.toString().padStart(3, '0')} m`;
  integrity.textContent = `${t.integrity}%`;
  marker.innerHTML = `<span class="stage-dot"></span>${t.phase === 'ready' ? 'SELECIONE UM TESTE E COMECE' : t.phase === 'running' ? `TESTE EM ANDAMENTO · ${Math.round(t.progress * 100)}% DA PISTA` : 'TESTE CONCLUÍDO'}`;
  document.body.classList.toggle('running', t.phase === 'running');
  driveControls.classList.toggle('visible', t.phase === 'running');
  hint.classList.toggle('hidden', t.phase === 'running');
  startBtn.querySelector('span')!.textContent = t.phase === 'ready' ? 'INICIAR TESTE' : 'REINICIAR TESTE';
}
function showResults(data: Result) {
  element('result-title').textContent = data.avoided ? 'DESAFIO SUPERADO' : 'IMPACTO REGISTRADO';
  element('survival').textContent = `${data.survival}`;
  element('impact-speed').textContent = data.avoided ? 'EVITADO' : `${data.speed} KM/H`;
  element('damage').textContent = `${data.damage}%`;
  results.classList.remove('hidden');
  results.classList.toggle('avoided', data.avoided);
  if (!muted) beep(data.avoided ? 520 : 140, 0.22);
}
function closeResults() { results.classList.add('hidden'); }
function start() {closeResults(); game.start(); if (!muted && !soundStarted) { void initAudio(); soundStarted = true; }}
function beep(frequency: number, duration: number) {
  if (!sound) return;
  const osc = sound.createOscillator(), gain = sound.createGain();
  osc.type = 'sawtooth'; osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.07, sound.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, sound.currentTime + duration);
  osc.connect(gain).connect(sound.destination);
  osc.start(); osc.stop(sound.currentTime + duration);
}
async function initAudio() {sound ??= new AudioContext(); await sound.resume();}

const keyboard = new Set<string>();
const keyMap: Record<string, 'left' | 'right' | 'brake' | 'throttle'> = {
  a:'left',arrowleft:'left',d:'right',arrowright:'right',s:'brake',arrowdown:'brake',' ':'brake',w:'throttle',arrowup:'throttle'
};
function syncKeys() {
  if (!game) return;
  game.setControls({
    left: keyboard.has('a') || keyboard.has('arrowleft'),
    right: keyboard.has('d') || keyboard.has('arrowright'),
    brake: keyboard.has('s') || keyboard.has('arrowdown') || keyboard.has(' '),
    throttle: true
  });
}
window.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (keyMap[key]) {e.preventDefault(); keyboard.add(key); syncKeys();}
  if (key === 'r' && !e.repeat) start();
  if (key === 'c' && !e.repeat) game?.toggleCamera();
});
window.addEventListener('keyup', e => {keyboard.delete(e.key.toLowerCase());syncKeys();});
window.addEventListener('blur', () => {keyboard.clear();syncKeys();game?.setControls({left:false,right:false,brake:false});});

function bindHold(id: string, control: 'left' | 'right' | 'brake') {
  const button = element<HTMLButtonElement>(id);
  const on = (e: PointerEvent) => {e.preventDefault();button.setPointerCapture(e.pointerId);game.setControls({[control]:true});button.classList.add('held');};
  const off = () => {game.setControls({[control]:false});button.classList.remove('held');};
  button.addEventListener('pointerdown',on);
  button.addEventListener('pointerup',off);
  button.addEventListener('pointercancel',off);
  button.addEventListener('lostpointercapture',off);
}

async function bootstrap() {
  game = new Game(canvas,{onTelemetry:showTelemetry,onResult:showResults});
  renderChoices();
  bindHold('left','left'); bindHold('right','right'); bindHold('brake','brake');
  startBtn.addEventListener('click',start);
  element('retry').addEventListener('click',start);
  element('camera').addEventListener('click',()=>game.toggleCamera());
  element('mute').addEventListener('click',async() => {
    muted = !muted;
    element('mute').textContent = muted ? '♪̸' : '♪';
    element('mute').setAttribute('aria-pressed',String(!muted));
    if (!muted) await initAudio();
  });
  await game.init();
  element('loading').classList.add('hidden');
}
void bootstrap().catch(err=>{
  element('loading').classList.add('hidden');
  element('fatal-message').textContent = err instanceof Error ? err.message : String(err);
  element('fatal').classList.remove('hidden');
  console.error('GameCrash failed to initialize:',err);
});
