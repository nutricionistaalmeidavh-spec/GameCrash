/** Continuous trilinear weights on the 6-ring / 4-corner structural cage.
 * Every vertex keeps its full support after beam rupture. Physical assemblies,
 * rather than arbitrary triangles, define the visual separation boundaries.
 */
type Vec={x:number;y:number;z:number};
type Node={rest:Vec;anchor:boolean};
const clamp01=(v:number)=>Math.max(0,Math.min(1,v));
export function cageWeights(nodes:readonly Node[],point:Vec){
  let a=0;while(a<4&&point.z>nodes[(a+1)*4].rest.z)a++;
  const b=a+1,z0=nodes[a*4].rest.z,z1=nodes[b*4].rest.z,t=clamp01((point.z-z0)/(z1-z0));
  const indices:number[]=[],weights:number[]=[];
  for(const [ring,rw] of [[a,1-t],[b,t]]){
    const low=nodes[ring*4].rest.y,high=nodes[ring*4+2].rest.y,up=clamp01((point.y-low)/(high-low));
    for(let level=0;level<2;level++){
      const left=ring*4+level*2,right=left+1;
      const across=clamp01((point.x-nodes[left].rest.x)/(nodes[right].rest.x-nodes[left].rest.x));
      indices.push(left,right);weights.push(rw*(level?up:1-up)*(1-across),rw*(level?up:1-up)*across);
    }
  }
  return {indices,weights};
}

/** Bound render-only sheet strain. Rapier still owns all impulses and fragments. */
export function sheetOffsets(nodes:readonly Node[],raw:readonly Vec[],travel:number):Vec[]{
  const positions=nodes.map((n,i)=>{
    const d=raw[i],factor=n.anchor?0:Math.min(1,travel/Math.max(.00001,Math.hypot(d.x,d.y,d.z)));
    return {x:n.rest.x+d.x*factor,y:n.rest.y+d.y*factor,z:n.rest.z+d.z*factor};
  });
  const edges:Array<[number,number]>=[];
  for(let ring=0;ring<6;ring++){
    for(const [a,b] of [[0,1],[0,2],[1,3],[2,3]])edges.push([ring*4+a,ring*4+b]);
    if(ring<5)for(let corner=0;corner<4;corner++)edges.push([ring*4+corner,(ring+1)*4+corner]);
  }
  for(let pass=0;pass<12;pass++)for(const [a,b] of edges){
    const p=positions[a],q=positions[b],u=nodes[a].rest,v=nodes[b].rest;
    const dx=q.x-p.x,dy=q.y-p.y,dz=q.z-p.z,distance=Math.hypot(dx,dy,dz);
    const allowed=Math.hypot(v.x-u.x,v.y-u.y,v.z-u.z)*1.2;
    if(distance<=allowed||nodes[a].anchor&&nodes[b].anchor)continue;
    const excess=(distance-allowed)/distance,wa=nodes[a].anchor?0:nodes[b].anchor?1:.5,wb=nodes[b].anchor?0:nodes[a].anchor?1:.5;
    p.x+=dx*excess*wa;p.y+=dy*excess*wa;p.z+=dz*excess*wa;
    q.x-=dx*excess*wb;q.y-=dy*excess*wb;q.z-=dz*excess*wb;
  }
  return positions.map((p,i)=>({x:p.x-nodes[i].rest.x,y:p.y-nodes[i].rest.y,z:p.z-nodes[i].rest.z}));
}
