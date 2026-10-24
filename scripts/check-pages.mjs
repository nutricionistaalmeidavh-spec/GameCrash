import {readFile} from 'node:fs/promises';
const expected=await readFile('dist/index.html','utf8');
const extract=(html,tag,attr,ext)=>{
  const tags=html.match(new RegExp(`<${tag}\\b[^>]*>`,'gi'))??[];
  return tags.map(x=>x.match(new RegExp(`${attr}=["']([^"']+\\.${ext})["']`,'i'))?.[1]).find(Boolean);
};
const expectedJs=extract(expected,'script','src','js');
const expectedCss=extract(expected,'link','href','css');
if(!expectedJs||!expectedCss)throw new Error('Vite bundle missing JavaScript/CSS');
const url=process.env.PAGE_URL??'https://nutricionistaalmeidavh-spec.github.io/GameCrash/';
let lastError='';
for(let i=1;i<=16;i++){
  try{
    const res=await fetch(url,{headers:{'Cache-Control':'no-cache'}});
    if(!res.ok)throw new Error(`Page HTTP ${res.status}`);
    const html=await res.text();
    const js=extract(html,'script','src','js'),css=extract(html,'link','href','css');
    if(html.includes('/src/main.ts')||js!==expectedJs||css!==expectedCss)
      throw new Error('GitHub Pages still serves raw sources or a stale build');
    for(const asset of [js,css]){
      const check=await fetch(new URL(asset,url));
      if(!check.ok)throw new Error(`Asset missing ${asset} HTTP ${check.status}`);
      const mime=check.headers.get('content-type')??'';
      if(asset.endsWith('.css')&&!mime.includes('css'))throw new Error(`CSS has invalid MIME: ${mime}`);
      if(asset.endsWith('.js')&&!/javascript|ecmascript/.test(mime))throw new Error(`JS has invalid MIME: ${mime}`);
    }
    console.log(`Live GitHub Pages compiled bundle verified: ${url}`);
    process.exit(0);
  }catch(err){
    lastError=String(err);console.log(`Pages check ${i}/16: ${lastError}`);
    if(i<16)await new Promise(resolve=>setTimeout(resolve,5000));
  }
}
throw new Error(`Live Pages smoke test failed: ${lastError}`);
