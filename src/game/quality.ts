/**
 * Dynamic *rendering* budget. Physics remains fixed at 120 Hz regardless of device,
 * viewport resolution, dropped frames, or this governor's decisions.
 */
export class AdaptiveRenderQuality {
  readonly shadowMapSize:number;
  readonly deformationInterval:number;
  private readonly maxPixels:number;
  private readonly maxRatio:number;
  private width=1;
  private height=1;
  private deviceRatio=1;
  private scale=1;
  private slowFrames=0;
  private fastFrames=0;

  constructor(readonly mobile:boolean){
    this.maxPixels=mobile?1_350_000:2_500_000;
    this.maxRatio=mobile?1.75:2;
    this.shadowMapSize=mobile?512:1024;
    this.deformationInterval=mobile?1/30:1/60;
  }
  configure(width:number,height:number,deviceRatio:number):number{
    this.width=Number.isFinite(width)?Math.max(1,width):1;
    this.height=Number.isFinite(height)?Math.max(1,height):1;
    this.deviceRatio=Number.isFinite(deviceRatio)&&deviceRatio>0?deviceRatio:1;
    return this.pixelRatio;
  }
  get pixelRatio():number {
    const maxByBudget=Math.sqrt(this.maxPixels/(this.width*this.height));
    const ratio=Math.min(this.deviceRatio,this.maxRatio,maxByBudget)*this.scale;
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
