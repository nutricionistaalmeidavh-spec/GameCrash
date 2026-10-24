export type VehicleId = 'sedan' | 'hatch' | 'suv';
export type ScenarioId = 'wall' | 'blocks' | 'ramp';
export type GamePhase = 'ready' | 'running' | 'crashed';
export interface VehicleSpec {
  id: VehicleId;
  name: string;
  kind: string;
  color: number;
  mass: number;
  acceleration: number;
  maxSpeed: number;
  resistance: number;
  size: [number, number, number];
}
export interface ScenarioSpec { id: ScenarioId; label: string; icon: string; subtitle: string; z: number }
export const VEHICLES: Record<VehicleId, VehicleSpec> = {
  sedan: { id:'sedan', name:'SEDAN GT',kind:'EQUILIBRADO', color:0xe7eff9,mass:1450,acceleration:12.5,maxSpeed:230,resistance:1,size:[1.9,1.12,4.55]},
  hatch: { id:'hatch', name:'HATCH RS',kind:'LEVE & RÁPIDO',color:0x80b2ff,mass:1080,acceleration:15,maxSpeed:250,resistance:0.77,size:[1.78,1.12,3.9]},
  suv: { id:'suv', name:'SUV TITAN',kind:'PESADO & FORTE',color:0xffc16e,mass:2130,acceleration:10,maxSpeed:195,resistance:1.2,size:[2.08,1.48,4.95]}
};
export const SCENARIOS: Record<ScenarioId,ScenarioSpec> = {
  wall: {id:'wall', label:'PAREDE',icon:'▤',subtitle:'Barreira de concreto',z:205},
  blocks: {id:'blocks',label:'BLOCOS',icon:'▥',subtitle:'Obstáculos em sequência',z:202},
  ramp: {id:'ramp',label:'MEGARAMPA',icon:'↗',subtitle:'Salto de alta velocidade',z:205}
};
export const clamp = (value:number,low:number,high:number):number => Math.min(high,Math.max(low,value));
export function kmh(metresPerSecond:number):number {return Math.max(0,metresPerSecond*3.6);}
export function fictionalImpact(speedKmh:number,vehicle:VehicleSpec,scenario:ScenarioId){
  const scaled = clamp(speedKmh,0,300)/100;
  const obstacle = scenario==='wall'?1:scenario==='blocks'?0.85:0.73;
  const damage = clamp(Math.round(25*scaled**1.5*obstacle/vehicle.resistance),0,100);
  const survival = clamp(Math.round(100-0.92*damage**1.08),1,100);
  return {damage,survival,energyKJ:Math.round(vehicle.mass*((speedKmh/3.6)**2)/2000)};
}
export function progressFraction(z:number,scenario:ScenarioId):number{return clamp(z/SCENARIOS[scenario].z,0,1)}
