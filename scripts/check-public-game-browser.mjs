import assert from 'node:assert/strict';
import {chromium,webkit} from '@playwright/test';

const url='https://rawcdn.githack.com/nutricionistaalmeidavh-spec/GameCrash/d119c750a98771caaf09a43c29c85300d77bfeb4/play/index.html';
for (const [name,engine,viewport,options] of [
  ['Chromium desktop',chromium,{width:1280,height:720},{args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']}],
  ['WebKit iPhone',webkit,{width:390,height:844},{}],
]) {
  const browser=await engine.launch({headless:true,...(name.startsWith('Chromium')?{args:options.args}:{})});
  try{
    const ctx=await browser.newContext({viewport,deviceScaleFactor:2,isMobile:name.startsWith('WebKit'),hasTouch:name.startsWith('WebKit')});
    const page=await ctx.newPage();
    const errors=[];
    page.on('pageerror',error=>{errors.push(error.message);console.error('PAGE ERROR '+name+': '+error.message)});
    page.on('console',msg=>{if(msg.type()==='error'||msg.type()==='warning')console.log('CONSOLE '+name+' '+msg.type()+' '+msg.text())});
    page.on('requestfailed',req=>console.log('REQUEST FAILED '+name+' '+req.url()+' '+req.failure()?.errorText));
    page.on('response',res=>{if(res.status()>=400)console.log('HTTP '+res.status()+' '+res.url())});
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:35_000});
    assert.equal(response?.status(),200,name+' HTML status');
    await page.waitForTimeout(5000);
    console.log('DIAGNOSTIC '+name+' '+JSON.stringify(await page.evaluate(()=>({
      title:document.title,htmlBytes:document.documentElement.outerHTML.length,
      loading:document.querySelector('#loading')?.className,
      phase:document.body.dataset.phase,vehicleCount:document.querySelectorAll('#vehicles button').length,
      scripts:[...document.scripts].map(x=>({src:x.src,type:x.type})),
      fatal:document.querySelector('#fatal')?.className,
      fatalText:document.querySelector('#fatal-message')?.textContent,
      mainCss:document.querySelector('#app')?getComputedStyle(document.querySelector('#app')).position:null
    }))));
    await page.locator('#loading').waitFor({state:'hidden',timeout:35_000});
    await page.locator('#vehicles button').first().waitFor({state:'visible',timeout:30_000});
    const count=await page.locator('#vehicles button').count();
    assert.equal(count,14,name+' vehicle choices');
    const CSS=await page.locator('#app').evaluate(node=>({font:getComputedStyle(node).fontFamily,layout:getComputedStyle(node).position}));
    assert.notEqual(CSS.layout,'static',name+' stylesheet must apply');
    assert.deepEqual(errors,[],name+' no runtime errors');
    await page.locator('[data-vehicle="sedan"]').click();
    await page.locator('#start').click();
    assert.equal(await page.locator('body').getAttribute('data-phase'),'running',name+' game starts');
    console.log('LIVE BROWSER PASS: '+name+' from '+url+', CSS '+JSON.stringify(CSS));
    await ctx.close();
  }finally{await browser.close()}
}
