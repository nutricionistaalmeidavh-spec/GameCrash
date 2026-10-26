/** Verify the public project root routes to the compiled GitHub Pages game. */
const root='https://nutricionistaalmeidavh-spec.github.io/GameCrash/';
const target='https://nutricionistaalmeidavh-spec.github.io/GameCrash/play/';
let lastError='';
for(let i=1;i<=24;i++){
  try{
    const response=await fetch(root,{cache:'no-store'});
    if(!response.ok)throw Error('GitHub Pages root HTTP '+response.status);
    const html=await response.text();
    if(!html.includes("url.pathname = '/GameCrash/play/';")||!html.includes('location.replace(url.href)'))
      throw Error('Root does not synchronously redirect to compiled /play/ game');
    const game=await fetch(target,{cache:'no-store'});
    if(!game.ok)throw Error('Compiled /play/ game HTTP '+game.status);
    console.log('GitHub Pages root and playable compiled URL verified: '+root);
    process.exit(0);
  }catch(error){
    lastError=String(error);
    console.log('Pages root check '+i+'/24: '+lastError);
    if(i<24)await new Promise(resolve=>setTimeout(resolve,5000));
  }
}
throw Error('Public root smoke failed: '+lastError);
