export interface RampPoint {z:number;y:number}
/** Road collider top: y = +0.075. Megaramp has a flush entry and gentle transition. */
export function buildRampProfile(centerZ:number):RampPoint[]{
  return [
    {z:centerZ-12,y:.075},
    {z:centerZ-8,y:.075},
    {z:centerZ-5,y:.26},
    {z:centerZ+8,y:3.36}
  ];
}
/** Shared vertices for the visible wedge and the exact same Rapier collider. */
export function rampSegmentVertices(a:RampPoint,b:RampPoint,width=9,bottom=-.19){
  const half=width/2;
  return new Float32Array([
    -half,bottom,a.z,half,bottom,a.z,-half,a.y,a.z,half,a.y,a.z,
    -half,bottom,b.z,half,bottom,b.z,-half,b.y,b.z,half,b.y,b.z
  ]);
}
