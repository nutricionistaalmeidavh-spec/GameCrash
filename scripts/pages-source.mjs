/** Ensure a GitHub Pages project uses Actions artifacts, not raw source/Jekyll. */
export async function ensureActionsSource({repository,token,fetchImpl=fetch}) {
  if(!repository||!token)throw new Error('Missing GITHUB_REPOSITORY or GITHUB_TOKEN');
  const endpoint=`https://api.github.com/repos/${repository}/pages`;
  const headers={Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'};
  const beforeResponse=await fetchImpl(endpoint,{headers});
  if(!beforeResponse.ok)throw new Error(`Unable to read GitHub Pages publishing source (HTTP ${beforeResponse.status}).`);
  const before=await beforeResponse.json();
  if(before.build_type==='workflow')return {changed:false,source:'workflow'};
  if(before.build_type!=='legacy')throw new Error(`Unexpected Pages publishing source: ${before.build_type??'unknown'}`);
  const update=await fetchImpl(endpoint,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({build_type:'workflow'})});
  if(!update.ok)throw new Error(`Unable to switch GitHub Pages to GitHub Actions (HTTP ${update.status}). Configure Settings > Pages > Source: GitHub Actions.`);
  const afterResponse=await fetchImpl(endpoint,{headers});
  if(!afterResponse.ok)throw new Error(`Unable to verify Pages settings (HTTP ${afterResponse.status}).`);
  const after=await afterResponse.json();
  if(after.build_type!=='workflow')throw new Error('Pages is still publishing raw branch/Jekyll sources.');
  return {changed:true,source:'workflow'};
}

if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  const result=await ensureActionsSource({repository:process.env.GITHUB_REPOSITORY,token:process.env.GITHUB_TOKEN});
  console.log(result.changed?'Pages source updated to GitHub Actions.':'Pages already uses GitHub Actions.');
}
