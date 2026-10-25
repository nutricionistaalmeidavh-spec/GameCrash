import {NodeIO,getBounds} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {weld,simplify,dedup,prune,textureCompress} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc=await io.read(process.argv[2]);
await MeshoptSimplifier.ready;
await doc.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:.25,error:.003}),dedup(),prune(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:82}));
const scene=doc.getRoot().listScenes()[0],bounds=getBounds(scene);
const scale=4.8/(bounds.max[2]-bounds.min[2]);
const axleNodes=doc.getRoot().listNodes().filter(n=>/^Wheel(Front|Rear)[LR]$/.test(n.getName()));
const centerZ=axleNodes.reduce((s,n)=>s+n.getWorldTranslation()[2],0)/4;
const centerX=(bounds.min[0]+bounds.max[0])/2;
const root=doc.createNode('CarConcept_Normalized').setScale([scale,scale,scale]).setTranslation([-centerX*scale,-bounds.min[1]*scale,-centerZ*scale]);
for(const child of scene.listChildren())root.addChild(child);scene.addChild(root);

const b=getBounds(scene),wheels=axleNodes.map(n=>({name:n.getName(),position:n.getWorldTranslation()}));
const front=wheels.filter(w=>w.name.includes('Front')),rear=wheels.filter(w=>w.name.includes('Rear'));
const y=wheels[0].position[1],track=Math.abs(wheels[0].position[0]-wheels[1].position[0]);
const triangles=doc.getRoot().listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),0);
const metadata={size:[b.max[0]-b.min[0],b.max[1]-b.min[1],4.8],wheelbase:front[0].position[2]-rear[0].position[2],wheelRadius:y,wheelTrack:track,wheelCenterY:y,triangles:Math.round(triangles),wheels};
for(const n of axleNodes){const p=n.getWorldTranslation();n.setName('concept-wheel-'+(p[0]<0?(p[2]<0?0:1):(p[2]<0?2:3)))}
await io.write('public/assets/concept/car.glb',doc);
await writeFile('src/game/concept.json',JSON.stringify(metadata,null,2)+'\n');console.log(metadata);
