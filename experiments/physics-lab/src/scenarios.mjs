/** Shared initial conditions. This is NOT a material-calibrated crash rating. */
export const PHYSICS_STEP = 1 / 120;
export const SAMPLE_STEPS = 480;
export const SCENARIOS = Object.freeze({
  wall: {label:'Parede', initialKmh:90, initialDistance:9, height:1.8, obstacle:'wall'},
  ramp: {label:'Rampa', initialKmh:90, initialDistance:9, height:1.8, obstacle:'ramp'},
  bumps: {label:'Lombadas', initialKmh:45, initialDistance:9, height:1.8, obstacle:'bumps'}
});
const round = value => Math.round(value*1000)/1000;
export function summarizeFrames(samples, fixedStepCount=SAMPLE_STEPS) {
  if(!Array.isArray(samples)||!samples.length) throw new Error('empty samples');
  if(samples.some(n=>!Number.isFinite(n)||n<0)) throw new Error('invalid durations');
  const sorted=[...samples].sort((a,b)=>a-b);
  const total=samples.reduce((a,b)=>a+b,0);
  return {
    steps:samples.length,
    totalMs:round(total),
    avgStepMs:round(total/samples.length),
    p95StepMs:round(sorted[Math.ceil(sorted.length*.95)-1]),
    simulatedSeconds:round(samples.length*PHYSICS_STEP),
    estimatedMaxSimulationHz:round(total?1000/(total/samples.length):0)
  };
}
export function exportBenchmark(engine,scenario,samples,observations={}) {
  if(!SCENARIOS[scenario])throw new Error('invalid scenario');
  return {
    schemaVersion:1,
    engine,scenario,config:SCENARIOS[scenario],
    environment:{
      userAgent:typeof navigator==='undefined'?'node / no real browser':navigator.userAgent,
      concurrency:typeof navigator==='undefined'?null:navigator.hardwareConcurrency||null,
      timestamp:new Date().toISOString()
    },
    metrics:summarizeFrames(samples),
    observations
  };
}
