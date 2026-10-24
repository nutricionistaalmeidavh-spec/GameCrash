import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ensureActionsSource} from '../scripts/pages-source.mjs';
const reply=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});

test('switches source publishing from raw branch to compiled GitHub Actions artifact',async()=>{
  const calls=[];
  const fetchImpl=async(url,opts)=>{calls.push({url,opts});return [reply(200,{build_type:'legacy'}),reply(204,null),reply(200,{build_type:'workflow'})][calls.length-1]};
  const result=await ensureActionsSource({repository:'owner/GameCrash',token:'fake',fetchImpl});
  assert.deepEqual(result,{changed:true,source:'workflow'});
  assert.deepEqual(calls.map(x=>x.opts.method??'GET'),['GET','PUT','GET']);
  assert.deepEqual(JSON.parse(calls[1].opts.body),{build_type:'workflow'});
});
test('does not reconfigure Pages already using Actions',async()=>{
  let count=0;const result=await ensureActionsSource({repository:'owner/GameCrash',token:'fake',fetchImpl:async()=>{count++;return reply(200,{build_type:'workflow'})}});
  assert.deepEqual(result,{changed:false,source:'workflow'});assert.equal(count,1);
});
test('fails visibly when token lacks Pages permission',async()=>{
  let count=0;
  await assert.rejects(ensureActionsSource({repository:'owner/GameCrash',token:'fake',fetchImpl:async()=>{count++;return count===1?reply(200,{build_type:'legacy'}):reply(403,{message:'Forbidden'})}}),/HTTP 403/);
});
