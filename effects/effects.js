import { CONFIG } from '../config/config.js';
import { state } from '../state.js';

let bloodParticleGeoSmall, bloodParticleGeoLarge, bloodDotGeo;
let bloodParticleMatSmall, bloodParticleMatLarge, bloodDotMat;
let damagePatchGeo, damagePatchMat;
let bloodDripGeo, bloodDripMat;
let bloodReflectMat, bloodDotReflectMat;
let bulletHoleGeo, bulletHoleRimGeo, bulletHoleMat, bulletHoleRimMat;
let debrisGeo, debrisGeoSmall, debrisMat;

let bloodParticles = [];
let bloodDecals = [];
let bloodPools = [];
let bloodLandingDots = [];
let damageMarks = [];
let bulletHoles = [];
let goreDebris = [];
let shellCasings = [];

const MAX_BLOOD_PARTICLES = 2600;
const MAX_BLOOD_DECALS = 180;
const MAX_BLOOD_POOLS = 90;
const MAX_BLOOD_LANDING_DOTS = 900;
const MAX_SHELL_CASINGS = 45;

function makeBloodMaterial(opacity=0.72) {
  const shades = [0x5d090d, 0x700d11, 0x841116, 0x96151a, 0x4c0709];
  return new THREE.MeshPhysicalMaterial({
    color: shades[Math.floor(Math.random() * shades.length)],
    roughness: 0.38,
    metalness: 0.0,
    clearcoat: 0.16,
    clearcoatRoughness: 0.24,
    transparent: true,
    opacity,
    depthWrite: false
  });
}

function ensureBloodAssets() {
  if (bloodParticleGeoSmall) return;

  bloodParticleGeoSmall = new THREE.SphereGeometry(1, 12, 8);
  bloodParticleGeoLarge = new THREE.SphereGeometry(1, 15, 12);
  bloodDotGeo = new THREE.CircleGeometry(1, 7);
  bloodParticleMatSmall = makeBloodMaterial(0.64);
  bloodParticleMatLarge = makeBloodMaterial(0.74);
  bloodDotMat = makeBloodMaterial(0.62);

  damagePatchGeo = new THREE.SphereGeometry(1, 8, 6);
  damagePatchMat = new THREE.MeshPhysicalMaterial({
    color: 0x4a0d10, roughness: 0.34, metalness: 0.0,
    clearcoat: 0.18, clearcoatRoughness: 0.18,
    transparent: true, opacity: 0.82, depthWrite: false
  });

  bloodDripGeo = new THREE.SphereGeometry(1, 6, 5);
  bloodDripMat = new THREE.MeshPhysicalMaterial({
    color: 0x5a0f13, roughness: 0.28, metalness: 0.0,
    clearcoat: 0.25, clearcoatRoughness: 0.15,
    transparent: true, opacity: 0.78, depthWrite: false
  });

  bulletHoleGeo = new THREE.CircleGeometry(1, 10);
  bulletHoleRimGeo = new THREE.RingGeometry(0.62, 1, 10);
  bulletHoleMat = new THREE.MeshStandardMaterial({
    color: 0x0c0a09, roughness: 0.55, metalness: 0.05,
    transparent: true, opacity: 0.92, depthWrite: false
  });
  bulletHoleRimMat = new THREE.MeshStandardMaterial({
    color: 0x2a1210, roughness: 0.7, metalness: 0.0,
    transparent: true, opacity: 0.6, depthWrite: false
  });

  debrisGeo = new THREE.DodecahedronGeometry(1, 0);
  debrisGeoSmall = new THREE.TetrahedronGeometry(1, 0);
  debrisMat = new THREE.MeshPhysicalMaterial({
    color: 0xc98f86, roughness: 0.68, metalness: 0.0,
    clearcoat: 0.08, clearcoatRoughness: 0.28
  });
}

function disposeBloodPool(pool) {
  if (!pool || !pool.group) return;
  state.scene.remove(pool.group);
  pool.group.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material && obj.material !== pool.material) obj.material.dispose();
  });
  if (pool.material) pool.material.dispose();
}

function spawnBloodLandingDot(position, scale=1, ownerNpc=null) {
  if (!CONFIG.bloodEffectsEnabled || !CONFIG.bloodLandingDotsEnabled) return;
  ensureBloodAssets();
  while (bloodLandingDots.length >= MAX_BLOOD_LANDING_DOTS) {
    const old = bloodLandingDots.shift();
    state.scene.remove(old.mesh);
  }
  const mesh = new THREE.Mesh(bloodDotGeo, bloodDotMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = Math.random() * Math.PI * 2;
  mesh.position.set(
    position.x + (Math.random() - 0.5) * 0.04 * CONFIG.bloodDotScatter,
    0.006,
    position.z + (Math.random() - 0.5) * 0.04 * CONFIG.bloodDotScatter
  );
  const base = (0.008 + Math.random() * 0.016) * CONFIG.bloodDotSize * scale;
  mesh.scale.set(base * (0.7 + Math.random()*0.8), base * (0.7 + Math.random()*1.2), 1);
  state.scene.add(mesh);
  bloodLandingDots.push({ mesh, owner: ownerNpc, life: CONFIG.bloodDotLifetime, maxLife: CONFIG.bloodDotLifetime });
}

function getHitSurfaceNormal(hitMesh, hitPoint, hitDir) {
  const fallback = hitDir.clone().multiplyScalar(-1).normalize();
  if (!hitMesh) return fallback;

  try {
    const origin = hitPoint.clone().add(hitDir.clone().multiplyScalar(0.035));
    const rayDir = hitDir.clone().multiplyScalar(-1).normalize();
    const ray = new THREE.Raycaster(origin, rayDir, 0, 0.08);
    const hit = ray.intersectObject(hitMesh, false)[0];
    if (hit && hit.face) {
      const q = new THREE.Quaternion();
      hitMesh.getWorldQuaternion(q);
      return hit.face.normal.clone().applyQuaternion(q).normalize();
    }
  } catch (_) {}
  return fallback;
}

function spawnDamageMark(hitMesh, hitPoint, hitDir, part, ownerNpc) {
  if (!CONFIG.damageMarksEnabled || !hitMesh || !ownerNpc) return;
  ensureBloodAssets();
  while (damageMarks.length >= CONFIG.damageMarkCap) {
    const old = damageMarks.shift();
    if (old.mesh.parent) old.mesh.parent.remove(old.mesh);
  }

  hitMesh.updateWorldMatrix(true, false);
  const surfaceNormalWorld = getHitSurfaceNormal(hitMesh, hitPoint, hitDir);
  const localPoint = hitMesh.worldToLocal(hitPoint.clone());
  const worldQ = new THREE.Quaternion();
  hitMesh.getWorldQuaternion(worldQ);
  const invQ = worldQ.clone().invert();
  const localNormal = surfaceNormalWorld.clone().applyQuaternion(invQ).normalize();

  const mark = new THREE.Mesh(damagePatchGeo, damagePatchMat);
  mark.position.copy(localPoint).addScaledVector(localNormal, -0.0035);
  mark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), localNormal);

  const base = CONFIG.damageMarkSize * (0.85 + Math.random() * 0.5);
  const partScale = part === 'head' ? 0.88 : (PART_INFO[part]?.kind === 'limb' ? 0.72 : 1.0);
  mark.scale.set(
    base * partScale * (0.85 + Math.random() * 0.30),
    base * partScale * (0.58 + Math.random() * 0.34),
    base * 0.22
  );
  mark.rotation.z = Math.random() * Math.PI * 2;
  mark.userData.owner = ownerNpc;
  mark.userData.part = part;
  hitMesh.add(mark);
  damageMarks.push({ mesh: mark, owner: ownerNpc });

  if (Math.random() < 0.7) {
    while (damageMarks.length >= CONFIG.damageMarkCap) {
      const old = damageMarks.shift();
      if (old.mesh.parent) old.mesh.parent.remove(old.mesh);
    }
    const worldDown = new THREE.Vector3(0, -1, 0);
    const localDown = worldDown.clone().applyQuaternion(invQ);
    localDown.addScaledVector(localNormal, -localDown.dot(localNormal));
    if (localDown.lengthSq() < 0.0001) localDown.set(0, -1, 0);
    localDown.normalize();

    const zAxis = localNormal.clone();
    const xAxis = new THREE.Vector3().crossVectors(localDown, zAxis).normalize();
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
    const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

    const dripLen = base * partScale * (1.6 + Math.random() * 2.2);
    const drip = new THREE.Mesh(bloodDripGeo, bloodDripMat);
    drip.position.copy(localPoint)
      .addScaledVector(localNormal, -0.003)
      .addScaledVector(localDown, dripLen * 0.42);
    drip.quaternion.setFromRotationMatrix(basis);
    drip.scale.set(base * partScale * 0.22, dripLen, base * 0.16);
    drip.userData.owner = ownerNpc;
    drip.userData.part = part;
    hitMesh.add(drip);
    damageMarks.push({ mesh: drip, owner: ownerNpc });
  }
}

function spawnBulletHole(hitMesh, hitPoint, hitDir, part, ownerNpc) {
  if (!CONFIG.bulletHolesEnabled || !hitMesh || !ownerNpc) return;
  ensureBloodAssets();
  while (bulletHoles.length >= CONFIG.bulletHoleCap) {
    const old = bulletHoles.shift();
    if (old.mesh.parent) old.mesh.parent.remove(old.mesh);
  }

  hitMesh.updateWorldMatrix(true, false);
  const surfaceNormalWorld = getHitSurfaceNormal(hitMesh, hitPoint, hitDir);
  const localPoint = hitMesh.worldToLocal(hitPoint.clone());
  const worldQ = new THREE.Quaternion();
  hitMesh.getWorldQuaternion(worldQ);
  const localNormal = surfaceNormalWorld.clone().applyQuaternion(worldQ.invert()).normalize();

  const group = new THREE.Group();
  group.position.copy(localPoint).addScaledVector(localNormal, -0.004);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), localNormal);

  const partScale = part === 'head' ? 0.85 : (PART_INFO[part]?.kind === 'limb' ? 0.7 : 1.0);
  const size = 0.026 * partScale * (0.75 + Math.random() * 0.5);

  const hole = new THREE.Mesh(bulletHoleGeo, bulletHoleMat);
  hole.scale.set(size, size, 1);
  group.add(hole);

  const rim = new THREE.Mesh(bulletHoleRimGeo, bulletHoleRimMat);
  rim.scale.set(size, size, 1);
  rim.position.z = 0.0004;
  group.add(rim);

  group.userData.owner = ownerNpc;
  group.userData.part = part;
  hitMesh.add(group);
  bulletHoles.push({ mesh: group, owner: ownerNpc });
}

function spawnHeadshotDebris(point, dir, ownerNpc) {
  if (!CONFIG.headshotDebrisEnabled) return;
  ensureBloodAssets();
  const count = Math.max(0, Math.min(CONFIG.headshotDebrisPerHit, 12));
  for (let i=0; i<count; i++) {
    while (goreDebris.length >= CONFIG.goreDebrisCap) {
      const old = goreDebris.shift();
      state.scene.remove(old.mesh);
    }
    const useSmall = Math.random() < 0.7;
    const size = (useSmall ? 0.005 : 0.008) + Math.random()*0.010;
    const mesh = new THREE.Mesh(useSmall ? debrisGeoSmall : debrisGeo, debrisMat);
    mesh.scale.set(
      size * (0.65 + Math.random()*0.85),
      size * (0.55 + Math.random()*0.80),
      size * (0.45 + Math.random()*0.75)
    );
    mesh.position.copy(point);
    mesh.rotation.set(Math.random()*6.28, Math.random()*6.28, Math.random()*6.28);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    state.scene.add(mesh);
    const vel = dir.clone().multiplyScalar(0.55+Math.random()*1.65).add(
      new THREE.Vector3((Math.random()-0.5)*0.9,0.25+Math.random()*1.0,(Math.random()-0.5)*0.9)
    );
    goreDebris.push({ mesh, vel, life: 0.30+Math.random()*0.50, owner: ownerNpc });
  }
}

function spawnImpactParticles(point, dir, ownerNpc=null) {
  if (!CONFIG.bloodEffectsEnabled) return;
  ensureBloodAssets();

  const part = ownerNpc ? ownerNpc.lastHitPart || '' : '';
  const kind = PART_INFO[part]?.kind || 'body';
  const base = Math.round(30 * THREE.MathUtils.clamp(CONFIG.bloodParticleMultiplier, 0.5, 6.0));
  const count = Math.max(6, Math.round(base * (part === 'head' ? 1.28 : kind === 'limb' ? 0.76 : 1.0)));

  while (bloodParticles.length + count > MAX_BLOOD_PARTICLES) {
    const old = bloodParticles.shift();
    state.scene.remove(old.mesh);
  }

  for (let i = 0; i < count; i++) {
    const large = Math.random() < (part === 'head' ? 0.10 : 0.07);
    const size = large ? 0.012 + Math.random()*0.017 : 0.0045 + Math.random()*0.012;
    const material = large ? bloodParticleMatLarge : bloodParticleMatSmall;
    const mesh = new THREE.Mesh(large ? bloodParticleGeoLarge : bloodParticleGeoSmall, material);
    mesh.scale.set(
      size * (1.2 + Math.random()*0.55),
      size * (2 + Math.random()*0.75),
      size * (1 + Math.random()*0.55)
    );
    mesh.position.copy(point);
    mesh.rotation.set(Math.random()*6.28, Math.random()*6.28, Math.random()*6.28);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    state.scene.add(mesh);

    const spread = new THREE.Vector3(
      (Math.random()-0.5) * (kind === 'limb' ? 1.9 : 2.5),
      0.10 + Math.random() * (part === 'head' ? 1.9 : 1.7),
      (Math.random()-0.5) * (kind === 'limb' ? 1.9 : 2.5)
    );
    const speed = large ? 0.65 + Math.random()*1.7 : 0.75 + Math.random()*2.5;
    const vel = dir.clone().multiplyScalar(speed).add(spread);
    const lifeScale = THREE.MathUtils.clamp(CONFIG.bloodParticleLifetime, 0.15, 1.5);
    bloodParticles.push({
      mesh, vel, owner: ownerNpc, baseScale: 1,
      life: (large ? 0.30 + Math.random()*0.40 : 0.18 + Math.random()*0.42) * lifeScale / 0.60,
      gravity: large ? 10.5 + Math.random()*2.5 : 12 + Math.random()*3.5,
      spin: (Math.random()-0.5)*8, blood: true
    });
  }
}

function spawnBloodPool(point, radius, ownerNpc = null, startAge = 0) {
  if (!CONFIG.bloodEffectsEnabled || !CONFIG.bloodPoolsEnabled) return;

  while (bloodPools.length >= MAX_BLOOD_POOLS) {
    const old = bloodPools.shift();
    disposeBloodPool(old);
  }

  const target = Math.max(0.30, radius * CONFIG.bloodPoolSize) * (0.86 + Math.random() * 0.22);
  const group = new THREE.Group();
  group.position.set(point.x, 0.009, point.z);
  group.rotation.y = Math.random() * Math.PI * 2;

  const material = makeBloodMaterial(CONFIG.bloodPoolOpacity);
  const pieces = [];
  const coreRadius = target * (0.72 + Math.random() * 0.12);
  const core = new THREE.Mesh(new THREE.CircleGeometry(1, 24), material);
  core.rotation.x = -Math.PI / 2;
  core.scale.set(coreRadius * (1.05 + Math.random() * 0.18), coreRadius * (0.72 + Math.random() * 0.18), 1);
  group.add(core);
  pieces.push(core);

  const satellites = 4 + Math.floor(Math.random() * 4);
  for (let i = 0; i < satellites; i++) {
    const a = Math.random() * Math.PI * 2;
    const distance = coreRadius * (0.48 + Math.random() * 0.62);
    const r = target * (0.16 + Math.random() * 0.27);
    const piece = new THREE.Mesh(new THREE.CircleGeometry(1, 20), material);
    piece.rotation.x = -Math.PI / 2;
    piece.rotation.z = Math.random() * Math.PI * 2;
    piece.position.set(Math.cos(a) * distance, 0.001, Math.sin(a) * distance * 0.72);
    piece.scale.set(r * (0.85 + Math.random() * 0.30), r * (0.55 + Math.random() * 0.35), 1);
    group.add(piece);
    pieces.push(piece);
  }

  const lobes = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < lobes; i++) {
    const a = Math.random() * Math.PI * 2;
    const distance = coreRadius * (0.72 + Math.random() * 0.38);
    const r = target * (0.07 + Math.random() * 0.11);
    const piece = new THREE.Mesh(new THREE.CircleGeometry(1, 16), material);
    piece.rotation.x = -Math.PI / 2;
    piece.position.set(Math.cos(a) * distance, 0.0015, Math.sin(a) * distance * 0.72);
    piece.scale.set(r * (0.8 + Math.random() * 0.4), r * (0.6 + Math.random() * 0.4), 1);
    group.add(piece);
    pieces.push(piece);
  }

  state.scene.add(group);
  group.scale.set(0.02, 0.02, 0.02);

  bloodPools.push({
    mesh: group,
    group,
    material,
    owner: ownerNpc,
    age: startAge,
    life: Infinity,
    targetScale: 1,
    targetX: 1,
    targetY: 1,
    pieces
  });
}

function spawnBloodPoolUnderNpc(npc, radius) {
  if (!npc || !npc.bodies || !CONFIG.bloodEffectsEnabled || !CONFIG.bloodPoolsEnabled) return;
  const torso = npc.bodies.torso;
  const pelvis = npc.bodies.pelvis;
  if (!torso && !pelvis) return;

  const source = pelvis || torso;
  const x = source.position.x;
  const z = source.position.z;

  spawnBloodPool(new THREE.Vector3(x, 0.009, z), radius, npc, CONFIG.bloodPoolDelay);
}

const PART_INFO = {
  head:      { kind: 'head',  dmg: 100 },
  torso:     { kind: 'body',  dmg: 50 },
  lowerTorso:{ kind: 'body',  dmg: 50 },
  upperTorso:{ kind: 'body',  dmg: 50 },
  pelvis:    { kind: 'body',  dmg: 50 },
  lUpperArm: { kind: 'limb',  dmg: 50 },
  rUpperArm: { kind: 'limb',  dmg: 50 },
  lForearm:  { kind: 'limb',  dmg: 50 },
  rForearm:  { kind: 'limb',  dmg: 50 },
  lThigh:    { kind: 'limb',  dmg: 50 },
  rThigh:    { kind: 'limb',  dmg: 50 },
  lShin:     { kind: 'limb',  dmg: 50 },
  rShin:     { kind: 'limb',  dmg: 50 }
};

function updateParticles(dt) {
  for (let i = state.bloodParticles.length - 1; i >= 0; i--) {
    const p = state.bloodParticles[i];

    p.vel.y -= (p.gravity || 9.8) * dt;
    p.mesh.position.addScaledVector(p.vel, dt);

    if (p.blood && p.mesh.position.y <= 0.012 && p.vel.y < 0) {
      const impactSpeed = Math.hypot(p.vel.x, p.vel.z);
      p.mesh.position.y = 0.012;
      spawnBloodLandingDot(p.mesh.position, THREE.MathUtils.clamp(0.8 + impactSpeed * 0.10, 0.8, 2.0), p.owner || null);
      p.life = 0;
    }

    p.vel.multiplyScalar(Math.max(0, 1 - dt * (p.blood ? 0.72 : 0.65)));
    if (p.spin) p.mesh.rotation.y += p.spin * dt;

    p.life -= dt;
    if (!p.blood && p.mesh.material && 'opacity' in p.mesh.material) {
      p.mesh.material.opacity = Math.max(0, Math.min(1, p.life * 2.9));
    }
    if (p.life <= 0) {
      state.scene.remove(p.mesh);
      if (p.simpleHit) p.mesh.material.dispose();
      state.bloodParticles.splice(i, 1);
    }
  }

  for (let i = state.goreDebris.length - 1; i >= 0; i--) {
    const d = state.goreDebris[i];
    d.vel.y -= 13 * dt;
    d.mesh.position.addScaledVector(d.vel, dt);
    d.mesh.rotation.x += 7 * dt;
    d.mesh.rotation.y += 5 * dt;
    d.life -= dt;
    if (d.mesh.position.y <= 0.012) {
      d.mesh.position.y = 0.012;
      d.life = 0;
    }
    if (d.life <= 0) {
      state.scene.remove(d.mesh);
      state.goreDebris.splice(i, 1);
    }
  }

  for (let i = state.bloodLandingDots.length - 1; i >= 0; i--) {
    const d = state.bloodLandingDots[i];
    d.life -= dt;
    if (d.life <= 0) {
      state.scene.remove(d.mesh);
      state.bloodLandingDots.splice(i, 1);
    }
  }

  for (let i = state.bloodPools.length - 1; i >= 0; i--) {
    const p = state.bloodPools[i];
    p.age += dt;
    const delay = CONFIG.bloodPoolDelay;
    const spread = Math.max(0.05, CONFIG.bloodPoolSpreadTime);

    if (p.age > delay) {
      const t = THREE.MathUtils.clamp((p.age - delay) / spread, 0, 1);
      const eased = t * t * (3 - 2 * t);
      const scale = 0.02 + eased * 0.98;
      p.mesh.scale.set(scale, scale, scale);
      p.material.opacity = CONFIG.bloodPoolOpacity * (0.15 + 0.85 * eased);
    }

    if (p.life !== Infinity) p.life -= dt;
  }

  for (let i = state.bloodDecals.length - 1; i >= 0; i--) {
    const d = state.bloodDecals[i];
    if (d.scaleProgress < d.targetScale) {
      d.scaleProgress += dt * 3.5;
      d.mesh.scale.set(d.scaleProgress, d.scaleProgress, d.scaleProgress);
    }
    d.life -= dt;
    if (d.life <= 1) d.mesh.material.opacity = Math.max(0, 0.85 * d.life);
    if (d.life <= 0) {
      state.scene.remove(d.mesh);
      if (d.mesh.geometry) d.mesh.geometry.dispose();
      if (d.mesh.material) d.mesh.material.dispose();
      state.bloodDecals.splice(i, 1);
    }
  }
}

export {
  makeBloodMaterial,
  ensureBloodAssets,
  disposeBloodPool,
  spawnBloodLandingDot,
  spawnImpactParticles,
  spawnBloodPool,
  spawnBloodPoolUnderNpc,
  spawnDamageMark,
  spawnBulletHole,
  spawnHeadshotDebris,
  updateParticles
};