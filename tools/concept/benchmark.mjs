import concept from '../../src/game/concept.json' with {type:'json'};
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,devices} from '@playwright/test';
const out=process.argv[2]??'qa/concept';await mkdir(out,{recursive:true});
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4175'],{stdio:'ignore'});
let browser;
try{
  for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:4175');break}catch{await new Promise(r=>setTimeout(r,100))}}
  browser=await chromium.launch({args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
  const results=[];
  for(const [name,options] of [['desktop',{viewport:{width:1280,height:720}}],['mobile',{...devices['iPhone 13'],defaultBrowserType:undefined}]]){
    const context=await browser.newContext(options),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const start=Date.now();await page.goto('http://127.0.0.1:4175');
    await page.locator('#game[data-model="concept"]').waitFor({timeout:90000});
    const loadMs=Date.now()-start;
    await page.screenshot({path:out+'/'+name+'-garage.png'});
    await page.locator('#start').click();await page.locator('#game[data-model="concept"]').waitFor({timeout:90000});
    await page.waitForTimeout(5000); // Warm shader compilation before measuring steady frames.
    const frames=await page.evaluate(()=>new Promise(resolve=>{
      let first=0,last=0;const intervals=[];
      function frame(now){if(!first)first=now;if(last)intervals.push(now-last);last=now;
        if(now-first<10000)requestAnimationFrame(frame);else{
          const sorted=[...intervals].sort((a,b)=>a-b);resolve({frames:intervals.length,averageFps:1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length),p95FrameMs:sorted[Math.floor(sorted.length*.95)]});
        }
      }requestAnimationFrame(frame);
    }));
    await page.screenshot({path:out+'/'+name+'-track.png'});
    results.push({name,viewport:page.viewportSize(),loadMs,...frames,...await page.locator('#game').evaluate(el=>({drawCalls:Number(el.dataset.drawCalls),renderedTriangles:Number(el.dataset.triangles)})),errors});await context.close();
  }
  await writeFile(out+'/benchmark.json',JSON.stringify({renderer:'Chromium / SwiftShader CPU, not an actual iPhone GPU',assetTriangles:concept.triangles,results},null,2)+'\n');
  console.log(JSON.stringify(results));
}finally{await browser?.close();server.kill('SIGTERM')}
