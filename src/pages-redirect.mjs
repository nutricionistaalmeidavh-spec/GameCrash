/** Fallback when GitHub Pages is configured to deploy unbuilt main sources. */
export function redirectToPublishedGame(href){
  const url=new URL(href);
  if(url.hostname!=='nutricionistaalmeidavh-spec.github.io')return null;
  if(url.pathname!=='/GameCrash/'&&url.pathname!=='/GameCrash/index.html')return null;
  url.pathname='/GameCrash/play/';
  return url.href;
}

if(typeof window!=='undefined'){
  const target=redirectToPublishedGame(window.location.href);
  if(target)window.location.replace(target);
}
