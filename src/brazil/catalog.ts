import manifest from './manifest.json' with {type:'json'};
export const BRAZIL_CARS=manifest.cars;
export const BRAZIL_MAPS=manifest.maps;
export type BrazilCarId=keyof typeof BRAZIL_CARS;
export type BrazilMapId=keyof typeof BRAZIL_MAPS;
