import type {GraphicsProfile} from './visuals.ts';
/** SwiftShader and llvmpipe render on the CPU; keep them on the low-cost path.
 *  Real phone and desktop GPUs remain on the adaptive visual budget.
 */
export function isSoftwareRenderer(name:string):boolean{
  return /swiftshader|llvmpipe|software renderer|softpipe|mesa x11/i.test(name);
}


/**
 * Dynamic *rendering* budget. Physics remains fixed at 120 Hz regardless of device,
 * viewport resolution, dropped frames, or this governor's decisions.
 */
export class AdaptiveRenderQuality {
  readonly mobile:boolean;
  private profile:GraphicsProfile='auto';
  get profileName(){return this.profile}
  setProfile(value:GraphicsProfile){this.profile=value;this.scale=1;this.fastFrames=0;this.slowFrames=0}
  get shadowMapSize(){return this.profile==='eco'?(this.mobile?256:512):this.profile==='ultra'?(this.mobile?1024:2048):this.mobile?512:1024}
  get deformationInterval(){return this.profile==='eco'?1/24:this.mobile?1/30:1/60}
  private readonly maxPixels:number;
  private readonly maxRatio:number;
  private width=1;
  private height=1;
  private deviceRatio=1;
  private scale=1;
  private slowFrames=0;
  private fastFrames=0;

  constructor(mobile:boolean){
    this.mobile=mobile;
    this.maxPixels=mobile?1_350_000:2_500_000;
    this.maxRatio=mobile?1.75:2;
  }
  configure(width:number,height:number,deviceRatio:number):number{
    this.width=Number.isFinite(width)?Math.max(1,width):1;
    this.height=Number.isFinite(height)?Math.max(1,height):1;
    this.deviceRatio=Number.isFinite(deviceRatio)&&deviceRatio>0?deviceRatio:1;
    return this.pixelRatio;
  }
  get pixelRatio():number {
    const maxPixels=this.profile==='eco'?this.mobile?700_000:1_200_000:this.profile==='ultra'?this.mobile?2_100_000:4_000_000:this.maxPixels;
    const maxRatio=this.profile==='eco'?1.15:this.profile==='ultra'?this.mobile?2.3:2.5:this.maxRatio;
    const maxByBudget=Math.sqrt(maxPixels/(this.width*this.height));
    const ratio=Math.min(this.deviceRatio,maxRatio,maxByBudget)*this.scale;
    // Floor, not round, so the pixel count never exceeds its declared budget.
    return Math.max(.45,Math.floor(ratio*100)/100);
  }
  /**
   * Hysteresis avoids reallocating the WebGL render target for isolated spikes.
   * Ignore background-tab/resume gaps, which are not meaningful GPU samples.
   */
  observe(frameMs:number):boolean {
    if(!Number.isFinite(frameMs)||frameMs<=0||frameMs>200)return false;
    if(frameMs>25){this.slowFrames++;this.fastFrames=0}
    else if(frameMs<17){this.fastFrames++;this.slowFrames=0}
    else {this.slowFrames=0;this.fastFrames=0}
    if(this.slowFrames>=24){
      this.slowFrames=0;
      const old=this.pixelRatio;
      this.scale=Math.max(.6,this.scale-.12);
      return this.pixelRatio!==old;
    }
    if(this.fastFrames>=180){
      this.fastFrames=0;
      const old=this.pixelRatio;
      this.scale=Math.min(1,this.scale+.06);
      return this.pixelRatio!==old;
    }
    return false;
  }
}
