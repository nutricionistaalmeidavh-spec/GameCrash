import {SPEEDBUMPS} from './rules.ts';

/** Arcade mode uses a fixed entry speed but keeps Rapier collision and suspension live. */
export const INSTANT_ACCELERATOR_KMH=200;
export type BumpOutcome='complete'|'out'|null;

/** The long course is finished only by reaching the end or physically leaving the world.
 *  100% structural damage, rolling, and elapsed time do not dismiss the game.
 */
export function bumpRunOutcome(state:{
  x:number;y:number;z:number;
  integrity:number;elapsed:number;overturnedTime:number;
}):BumpOutcome {
  if(state.z>=SPEEDBUMPS.finishZ)return 'complete';
  if(state.y< -6||Math.abs(state.x)>45)return 'out';
  return null;
}
