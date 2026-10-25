import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CameraFollower} from '../src/game/camera.ts';

test('chase camera aims at chassis center while car rolls, pitches and tumbles',()=>{
  const follower=new CameraFollower();
  const pos=new THREE.Vector3(0,1,0);
  const q=new THREE.Quaternion();
  const vel=new THREE.Vector3(0,0,200/3.6);
  for(let i=0;i<240;i++){
    pos.addScaledVector(vel,1/60);
    pos.y=1+Math.sin(i*.05)*4;
    q.setFromEuler(new THREE.Euler(i*.08,i*.02,i*.11,'YXZ'));
    const state=follower.update(pos,q,vel,1/60,'running',0,0,0);
    assert.ok(state.target.distanceTo(pos.clone().add(new THREE.Vector3(0,.45,0)))<2.1,'focus must remain on the car center in high-speed flips');
    assert.ok(state.position.distanceTo(pos)<23,'camera must not lag behind at 200 km/h');
    assert.ok(state.position.distanceTo(pos)>4,'camera must not clip through the car');
    assert.ok(Number.isFinite(state.position.x+state.position.y+state.position.z));
  }
});
test('a 180-degree roof flip cannot reverse chase direction while continuing forwards',()=>{
  const follower=new CameraFollower();
  const p=new THREE.Vector3(0,2,30),v=new THREE.Vector3(0,0,55);
  follower.update(p,new THREE.Quaternion(),v,1/60,'running',0,0,0);
  const upside=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI);
  for(let i=0;i<12;i++)follower.update(p,upside,v,1/60,'running',0,0,0);
  assert.ok(follower.heading.z>.6,'upside-down orientation must not flip camera behind the wrong direction');
});
test('inspection orbit and second side camera keep wreck centered',()=>{
  const follower=new CameraFollower(),p=new THREE.Vector3(38,6,420),v=new THREE.Vector3(0,0,0);
  follower.reset(p);
  const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI);
  const normal=follower.update(p,q,v,.03,'crashed',0,0,0);
  const rotated=follower.update(p,q,v,.03,'crashed',0,Math.PI/2,.3);
  assert.ok(rotated.position.distanceTo(normal.position)>1);
  assert.ok(rotated.target.distanceTo(p.clone().add(new THREE.Vector3(0,.45,0)))<1);
  const other=follower.update(p,q,v,.03,'crashed',1,0,0);
  assert.ok(other.position.distanceTo(p)>5);
});
test('large physics hops and paused frames do not leave the car outside the framing',()=>{
  const follower=new CameraFollower(),q=new THREE.Quaternion();
  follower.reset(new THREE.Vector3(0,2,0));
  follower.update(new THREE.Vector3(0,2,0),q,new THREE.Vector3(),1/60,'running',0,0,0);
  const jumped=new THREE.Vector3(7,38,140);
  const state=follower.update(jumped,q,new THREE.Vector3(0,5,65),.07,'running',0,0,0);
  assert.ok(state.target.distanceTo(jumped.clone().add(new THREE.Vector3(0,.45,0)))<2.1);
  assert.ok(state.position.distanceTo(jumped)<23);
});
