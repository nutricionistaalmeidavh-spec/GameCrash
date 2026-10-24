// Shared mesh/collider coordinates: a rounded 3.2 m long, 20 cm high speed bump.
export function bumpShape(){
  const vertices:number[]=[],indices:number[]=[],segments=16;
  for(const x of [-9,9])for(let i=0;i<=segments;i++)vertices.push(x,.075+.20*Math.sin(i/segments*Math.PI),-1.6+i/segments*3.2);
  const row=segments+1;
  for(let i=0;i<segments;i++){
    indices.push(i,i+1,row+i,i+1,row+i+1,row+i);
    if(i>0)indices.push(0,i+1,i,row,row+i,row+i+1);
  }
  indices.push(0,row,segments,row,row+segments,segments);
  return {vertices:new Float32Array(vertices),indices};
}
