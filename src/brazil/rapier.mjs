/**
 * Optional bridge to the existing @dimforge/rapier3d-compat world.
 * All COLLIDER_* meshes are visible scene geometry as well.
 * The game should continue owning its own simulation tick/controls.
 */
import { Vector3 } from 'three';

export function attachBrazilRoadColliders(RAPIER, world, mapObject) {
  mapObject.updateMatrixWorld(true);
  const rigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const created = [];
  const p = new Vector3();
  mapObject.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.name.startsWith('COLLIDER_')) return;
    const attr = mesh.geometry.getAttribute('position');
    if (!attr || attr.count < 3) return;
    const positions = new Float32Array(attr.count * 3);
    for (let i = 0; i < attr.count; i++) {
      p.fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld);
      positions.set([p.x, p.y, p.z], i * 3);
    }
    const source = mesh.geometry.index?.array;
    const indices = source ? Uint32Array.from(source)
      : Uint32Array.from({ length: attr.count }, (_, i) => i);
    if (indices.length % 3) throw new Error(`Triângulos inválidos: ${mesh.name}`);
    const desc = RAPIER.ColliderDesc.trimesh(positions, indices);
    created.push(world.createCollider(desc, rigidBody));
  });
  if (!created.length) {
    world.removeRigidBody(rigidBody);
    throw new Error('Mapa sem malhas COLLIDER_: verifique o GLB');
  }
  return { rigidBody, colliders: created };
}

export function createSimpleBrazilChassis(RAPIER, world, car, spawn) {
  const { halfExtents, center } = car.collider;
  const yaw = spawn.yawRad ?? 0;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(...spawn.position)
      .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
      .setLinearDamping(0.06)
      .setAngularDamping(0.3)
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(...halfExtents)
      .setTranslation(...center)
      .setMass(car.massKg)
      .setFriction(0.9),
    body
  );
  return { body, collider };
}

export function syncBrazilCarVisual(carObject, body) {
  const pos = body.translation();
  const rot = body.rotation();
  carObject.position.set(pos.x, pos.y, pos.z);
  carObject.quaternion.set(rot.x, rot.y, rot.z, rot.w);
}
