import {BRAZIL_CARS,BRAZIL_MAPS,type BrazilCarId,type BrazilMapId} from '../brazil/catalog.ts';

export type VehicleId = 'sedan' | 'hatch' | 'suv' | BrazilCarId;
export type SceneryId = 'original' | BrazilMapId;
export const BRAZIL_SCENERY=BRAZIL_MAPS;
export const SCENERIES:Record<SceneryId,{label:string;file?:string}>={
  original:{label:'Pista original'},
  ...Object.fromEntries(Object.entries(BRAZIL_MAPS).map(([id,map])=>[id,{label:map.name,file:map.file}]))
} as Record<SceneryId,{label:string;file?:string}>;
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
  modelFile?:string;
}
export interface ScenarioSpec { id: ScenarioId; label: string; icon: string; subtitle: string; z: number }
export const VEHICLES: Record<VehicleId, VehicleSpec> = {
  sedan: { id:'sedan', name:'SEDAN GT',kind:'EQUILIBRADO', color:0xe7eff9,mass:1450,acceleration:12.5,maxSpeed:230,resistance:1,size:[1.9,1.12,4.55]},
  hatch: { id:'hatch', name:'HATCH RS',kind:'LEVE & RÁPIDO',color:0x80b2ff,mass:1080,acceleration:15,maxSpeed:250,resistance:0.77,size:[1.78,1.12,3.9]},
  suv: { id:'suv', name:'SUV TITAN',kind:'PESADO & FORTE',color:0xffc16e,mass:2130,acceleration:10,maxSpeed:195,resistance:1.2,size:[2.08,1.48,4.95]},
  ...Object.fromEntries(Object.entries(BRAZIL_CARS).map(([id,car])=>{
    const paint:Record<string,number>={gol:0xe7e7e7,strada:0xb23e41,palio:0xc9cbcc,onix:0x3278af,
      uno:0xe0d7bd,hb20:0xd9dde0,fiesta:0x40516c,ka:0xcb9e39,fox:0xc7c9c5,celta:0xa74239};
    const width=car.widthMeters,height=car.heightMeters,length=car.lengthMeters;
    return [id,{id:id as VehicleId,name:car.name.toUpperCase(),kind:'BRASIL · '+car.kind.toUpperCase(),
      color:paint[id]??0xd0d0d0,mass:car.massKg,
      acceleration:Math.round((10+(1300-car.massKg)/260)*10)/10,maxSpeed:215,
      resistance:Math.max(.68,Math.min(1.15,car.massKg/1200)),
      size:[width,height,length],modelFile:car.file} satisfies VehicleSpec];
  }))
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
