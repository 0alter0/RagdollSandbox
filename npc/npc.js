import { CONFIG, BONE, GROUP_GROUND, GROUP_RAGDOLL, GROUP_SHELL, MAX_BLOOD_PARTICLES, MAX_BLOOD_DECALS, MAX_BLOOD_POOLS, MAX_BLOOD_LANDING_DOTS, MAX_SHELL_CASINGS, SKIN_COLOR, SHIRT_COLOR, NPC_SHIRT_COLORS, JEANS_COLOR, SHOE_COLOR, BELT_COLOR } from '../config/config.js';
import { state } from '../state.js';

function cellKey(x, z) { return x + ',' + z; }
function doorKeyOf(a, b) {
  const [p, q] = (a.x < b.x || (a.x === b.x && a.z < b.z)) ? [a, b] : [b, a];
  return cellKey(p.x, p.z) + '|' + cellKey(q.x, p.z);
}
function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function spawnNPC(x, z, angle, isDummy = false) {
  const npc = {
    threeGroup: new THREE.Group(),
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)),
    target: null,
    wanderTimer: 0,
    wanderTarget: null,
    health: 100,
    maxHealth: 100,
    alive: true,
    deathElapsed: 0,
    hitTimer: 0,
    painTimer: 0,
    limpTimer: 0,
    stumbleTimer: 0,
    ragdoll: null,
    isDummy: isDummy,
    weapon: pick(['pistol', 'shotgun', 'ak']),
    ammo: CONFIG.magSize,
    fireTimer: 0,
    reloadTimer: 0,
    reloading: false,
    lastHitTime: 0,
    headBobOffset: 0,
    headBobPhase: 0,
    walkTimer: 0,
    parts: {},
    hitboxScale: CONFIG.hitboxScale,
    showHitboxes: CONFIG.showHitboxes
  };

  buildNPC(npc);

  npc.threeGroup.position.set(x, 0, z);
  npc.threeGroup.rotation.y = angle;

  state.scene.add(npc.threeGroup);

  state.npcs.push(npc);

  return npc;
}

function buildNPC(npc) {
  const group = npc.threeGroup;
  group.name = 'NPC';

  const torsoGeo = new THREE.CylinderGeometry(BONE.torsoR, BONE.torsoR, BONE.torsoLen, 8);
  torsoGeo.translate(0, BONE.torsoLen / 2, 0);
  const torsoMat = new THREE.MeshStandardMaterial({ color: pick(NPC_SHIRT_COLORS), roughness: 0.8, metalness: 0.1 });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  const headGeo = new THREE.SphereGeometry(BONE.headR, 12, 12);
  headGeo.translate(0, BONE.torsoLen + BONE.headR, 0);
  const headMat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 0.85, metalness: 0.0 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);

  const pelvisGeo = new THREE.SphereGeometry(BONE.torsoR * 1.1, 8, 8);
  pelvisGeo.translate(0, 0, 0);
  const pelvisMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9, metalness: 0.0 });
  const pelvis = new THREE.Mesh(pelvisGeo, pelvisMat);
  pelvis.castShadow = true;
  pelvis.receiveShadow = true;
  group.add(pelvis);

  const upperArmGeo = new THREE.CylinderGeometry(BONE.upperArmR, BONE.upperArmR, BONE.upperArmLen, 6);
  upperArmGeo.translate(0, BONE.upperArmLen / 2, 0);
  const upperArmMat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 0.85, metalness: 0.0 });
  const leftUpperArm = new THREE.Mesh(upperArmGeo, upperArmMat);
  leftUpperArm.position.set(-BONE.shoulderX, BONE.torsoLen, 0);
  leftUpperArm.castShadow = true;
  leftUpperArm.receiveShadow = true;
  group.add(leftUpperArm);
  const rightUpperArm = new THREE.Mesh(upperArmGeo, upperArmMat);
  rightUpperArm.position.set(BONE.shoulderX, BONE.torsoLen, 0);
  rightUpperArm.castShadow = true;
  rightUpperArm.receiveShadow = true;
  group.add(rightUpperArm);

  const forearmGeo = new THREE.CylinderGeometry(BONE.forearmR, BONE.forearmR, BONE.forearmLen, 6);
  forearmGeo.translate(0, BONE.forearmLen / 2, 0);
  const forearmMat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 0.85, metalness: 0.0 });
  const leftForearm = new THREE.Mesh(forearmGeo, forearmMat);
  leftForearm.position.set(-BONE.shoulderX - BONE.upperArmLen, BONE.torsoLen - BONE.upperArmLen / 2, 0);
  leftForearm.rotation.z = -Math.PI / 6;
  leftForearm.castShadow = true;
  leftForearm.receiveShadow = true;
  group.add(leftForearm);
  const rightForearm = new THREE.Mesh(forearmGeo, forearmMat);
  rightForearm.position.set(BONE.shoulderX + BONE.upperArmLen, BONE.torsoLen - BONE.upperArmLen / 2, 0);
  rightForearm.rotation.z = Math.PI / 6;
  rightForearm.castShadow = true;
  rightForearm.receiveShadow = true;
  group.add(rightForearm);

  const handGeo = new THREE.BoxGeometry(BONE.handR * 2, BONE.handR, BONE.handR * 0.6);
  handGeo.translate(0, 0, 0);
  const handMat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 0.85, metalness: 0.0 });
  const leftHand = new THREE.Mesh(handGeo, handMat);
  leftHand.position.set(-BONE.shoulderX - BONE.upperArmLen - BONE.forearmLen, BONE.torsoLen - BONE.upperArmLen / 2 - BONE.forearmLen / 2, 0);
  leftHand.castShadow = true;
  leftHand.receiveShadow = true;
  group.add(leftHand);
  const rightHand = new THREE.Mesh(handGeo, handMat);
  rightHand.position.set(BONE.shoulderX + BONE.upperArmLen + BONE.forearmLen, BONE.torsoLen - BONE.upperArmLen / 2 - BONE.forearmLen / 2, 0);
  rightHand.castShadow = true;
  rightHand.receiveShadow = true;
  group.add(rightHand);

  const thighGeo = new THREE.CylinderGeometry(BONE.thighR, BONE.thighR, BONE.thighLen, 6);
  thighGeo.translate(0, BONE.thighLen / 2, 0);
  const thighMat = new THREE.MeshStandardMaterial({ color: JEANS_COLOR, roughness: 0.9, metalness: 0.0 });
  const leftThigh = new THREE.Mesh(thighGeo, thighMat);
  leftThigh.position.set(-BONE.hipX, -BONE.torsoLen / 2, 0);
  leftThigh.castShadow = true;
  leftThigh.receiveShadow = true;
  group.add(leftThigh);
  const rightThigh = new THREE.Mesh(thighGeo, thighMat);
  rightThigh.position.set(BONE.hipX, -BONE.torsoLen / 2, 0);
  rightThigh.castShadow = true;
  rightThigh.receiveShadow = true;
  group.add(rightThigh);

  const shinGeo = new THREE.CylinderGeometry(BONE.shinR, BONE.shinR, BONE.shinLen, 6);
  shinGeo.translate(0, BONE.shinLen / 2, 0);
  const shinMat = new THREE.MeshStandardMaterial({ color: JEANS_COLOR, roughness: 0.9, metalness: 0.0 });
  const leftShin = new THREE.Mesh(shinGeo, shinMat);
  leftShin.position.set(-BONE.hipX, -BONE.torsoLen - BONE.thighLen / 2, 0);
  leftShin.castShadow = true;
  leftShin.receiveShadow = true;
  group.add(leftShin);
  const rightShin = new THREE.Mesh(shinGeo, shinMat);
  rightShin.position.set(BONE.hipX, -BONE.torsoLen - BONE.thighLen / 2, 0);
  rightShin.castShadow = true;
  rightShin.receiveShadow = true;
  group.add(rightShin);

  const footGeo = new THREE.BoxGeometry(BONE.shinR * 2.2, BONE.shinR * 0.6, BONE.shinR * 2.8);
  footGeo.translate(0, -BONE.shinR * 0.3, 0);
  const footMat = new THREE.MeshStandardMaterial({ color: SHOE_COLOR, roughness: 0.9, metalness: 0.0 });
  const leftFoot = new THREE.Mesh(footGeo, footMat);
  leftFoot.position.set(-BONE.hipX, -BONE.torsoLen - BONE.thighLen - BONE.shinLen, 0);
  leftFoot.castShadow = true;
  leftFoot.receiveShadow = true;
  group.add(leftFoot);
  const rightFoot = new THREE.Mesh(footGeo, footMat);
  rightFoot.position.set(BONE.hipX, -BONE.torsoLen - BONE.thighLen - BONE.shinLen, 0);
  rightFoot.castShadow = true;
  rightFoot.receiveShadow = true;
  group.add(rightFoot);

  npc.parts = {
    torso, head, pelvis,
    leftUpperArm, rightUpperArm,
    leftForearm, rightForearm,
    leftHand, rightHand,
    leftThigh, rightThigh,
    leftShin, rightShin,
    leftFoot, rightFoot
  };
}

function clearNpcs() {
  for (const npc of state.npcs) {
    if (npc.threeGroup) {
      npc.threeGroup.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        }
      });
      state.scene.remove(npc.threeGroup);
    }
    if (npc.ragdoll) {
      Object.values(npc.ragdoll).forEach((body) => {
        if (body && state.world) state.world.removeBody(body);
      });
    }
  }
  state.npcs = [];
}

function updateNpcs() {
  for (const npc of state.npcs) {
    if (!npc.alive) {
      updateNpcDeath(npc);
      continue;
    }
    updateNpcAI(npc);
    updateNpcAnimation(npc);
    updateNpcWeapon(npc);
    updateNpcHitEffects(npc);
  }
}

function updateNpcAI(npc) {
  if (npc.isDummy) return;

  npc.wanderTimer += state.deltaTime;
  npc.hitTimer = Math.max(0, npc.hitTimer - state.deltaTime);
  npc.painTimer = Math.max(0, npc.painTimer - state.deltaTime);
  npc.limpTimer = Math.max(0, npc.limpTimer - state.deltaTime);
  npc.stumbleTimer = Math.max(0, npc.stumbleTimer - state.deltaTime);

  if (CONFIG.npcPanic && !npc.panic) {
    const panicChance = state.npcs.filter(n => !n.alive || n.health < n.maxHealth * 0.5).length / state.npcs.length;
    if (Math.random() < panicChance * CONFIG.npcPanicDuration * state.deltaTime) {
      npc.panic = true;
      npc.panicTimer = CONFIG.npcPanicDuration;
    }
  }
  if (npc.panic) {
    npc.panicTimer -= state.deltaTime;
    if (npc.panicTimer <= 0) npc.panic = false;
  }

  if (!npc.target || npc.target.reached) {
    chooseNpcWanderTarget(npc, npc.panic);
  }

  if (npc.target && !npc.target.reached) {
    const dt = state.deltaTime;
    const speed = npc.panic
      ? THREE.MathUtils.lerp(CONFIG.npcPanicSpeedMin, CONFIG.npcPanicSpeedMax, Math.random())
      : THREE.MathUtils.lerp(CONFIG.npcWalkSpeedMin, CONFIG.npcWalkSpeedMax, Math.random());
    const moveAmount = speed * dt;

    const dir = new THREE.Vector3()
      .subVectors(npc.target.position, npc.threeGroup.position)
      .setY(0)
      .normalize();

    npc.threeGroup.position.addScaledVector(dir, moveAmount);
    npc.threeGroup.rotation.y = Math.atan2(dir.x, dir.z);

    if (npc.threeGroup.position.distanceTo(npc.target.position) < 0.5) {
      npc.target.reached = true;
    }
  }
}

function chooseNpcWanderTarget(npc, isPanic = false) {
  if (npc.target) {
    npc.target.reached = true;
  }

  const radius = isPanic
    ? THREE.MathUtils.lerp(CONFIG.npcPanicSpeedMin, CONFIG.npcPanicSpeedMax, Math.random()) * CONFIG.npcPanicDuration
    : THREE.MathUtils.lerp(CONFIG.npcWanderMin, CONFIG.npcWanderMax, Math.random());
  const angle = Math.random() * Math.PI * 2;
  const targetPos = new THREE.Vector3(
    npc.threeGroup.position.x + Math.cos(angle) * radius,
    0,
    npc.threeGroup.position.z + Math.sin(angle) * radius
  );

  const half = CONFIG.arenaHalf - 2;
  targetPos.x = THREE.MathUtils.clamp(targetPos.x, -half, half);
  targetPos.z = THREE.MathUtils.clamp(targetPos.z, -half, half);

  npc.target = { position: targetPos, reached: false };
  npc.wanderTimer = 0;
}

function updateNpcAnimation(npc) {
  if (!npc.alive) return;

  npc.walkTimer += state.deltaTime * (npc.target ? 2 : 0.5); 
  const walkSpeed = npc.target ? 1.5 : 0.5;
  const bobAmount = 0.01 * walkSpeed;
  npc.headBobOffset = Math.sin(npc.walkTimer) * bobAmount;

  npc.parts.head.position.y = BONE.torsoLen + BONE.headR + npc.headBobOffset;

  if (npc.limpTimer > 0) {
    const limpAmount = Math.sin(npc.walkTimer * 2) * 0.05 * (1 - npc.limpTimer / CONFIG.painWrithingDuration);
    npc.parts.leftFoot.position.z += limpAmount;
    npc.parts.rightFoot.position.z -= limpAmount;
  }

  if (npc.stumbleTimer > 0) {
    const stumbleAmount = Math.random() * 0.1 * (npc.stumbleTimer / CONFIG.stumbleDurationMax);
    npc.threeGroup.position.x += (Math.random() - 0.5) * stumbleAmount;
    npc.threeGroup.position.z += (Math.random() - 0.5) * stumbleAmount;
  }
}

function updateNpcWeapon(npc) {
  if (!npc.alive) return;

  npc.fireTimer = Math.max(0, npc.fireTimer - state.deltaTime);
  npc.reloadTimer = Math.max(0, npc.reloadTimer - state.deltaTime);

  if (npc.reloadTimer <= 0 && !npc.reloading && npc.ammo < CONFIG.magSize && !npcc.isDummy) {
    npc.reloading = true;
    npc.reloadTimer = CONFIG.reloadTime;
    npc.fireTimer = 0;
  }

  if (npc.target && !npc.target.reached && npc.fireTimer <= 0 && !npc.reloading && npc.ammo > 0) {
    fireNpcWeaponAtPlayer(npc);
    npc.fireTimer = getNpcWeaponCooldown(npc.weapon);
    npc.ammo--;
  }
}

function fireNpcWeaponAtPlayer(npc) {
  if (!state.player || !state.player.alive) return;

  let muzzlePos = new THREE.Vector3(0, 0, 0);
  npc.threeGroup.traverse((child) => {
    if (child.isMesh && child.name === 'rightHand') {
      child.getWorldPosition(muzzlePos);
    }
  });

  const direction = new THREE.Vector3()
    .subVectors(state.player.position, muzzlePos)
    .normalize();

  const raycaster = new THREE.Raycaster(muzzlePos, direction);
  const hitDistance = muzzlePos.distanceTo(state.player.position);
  const hits = raycaster.intersectObject(state.player, true);
  if (hits.length > 0 && hits[0].distance <= hitDistance) {
    hitPlayer(state.player, hits[0].point, hits[0].face.normal);
  }
  // this stuff is just place holders for when we add actual enemies, unsued, do not care for
  createNpcMuzzleFlash(npc, muzzlePos);

  playNpcGunshotSound();

  applyNpcRecoil(npc);
}

function createNpcMuzzleFlash(npc, position) {
  const muzzleGeo = new THREE.SphereGeometry(0.02, 8, 8);
  const muzzleMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
  const muzzleFlash = new THREE.Mesh(muzzleGeo, muzzleMat);
  muzzleFlash.position.copy(position);
  muzzleFlash.visible = true;
  npc.threeGroup.add(muzzleFlash);
  setTimeout(() => {
    if (muzzleFlash.parent) {
      muzzleFlash.visible = false;
    }
  }, 50);
}

function playNpcGunshotSound() {
  console.log('NPC gunshot sound would play here');
}

function applyNpcRecoil(npc) {
}

function getNpcWeaponCooldown(weaponType) {
  switch (weaponType) {
    case 'shotgun': return 0.4;
    case 'ak': return 0.1;
    case 'pistol':
    default: return 0.14;
  }
}

function updateNpcHitEffects(npc) {
  if (!npc.alive) return;

  if (npc.hitTimer > 0) {
    npc.threeGroup.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.color.set(0xff0000);
      }
    });
  } else {
    npc.threeGroup.traverse((child) => {
      if (child.isMesh && child.material) {

        if (child.name.includes('Head')) child.material.color.set(SKIN_COLOR);
        else if (child.name.includes('Torso') || child.name.includes('Pelvis')) child.material.color.set(pick(NPC_SHIRT_COLORS));
        else if (child.name.includes('Thigh') || child.name.includes('Shin')) child.material.color.set(JEANS_COLOR);
        else if (child.name.includes('Foot')) child.material.color.set(SHOE_COLOR);
        else child.material.color.set(SKIN_COLOR);
      }
    });
  }
}

function hitNPC(npc, point, normal, damage = 20) {
  if (!npc.alive) return;

  npc.health -= damage;
  npc.hitTimer = 0.2; 
  npc.lastHitTime = state.clock.elapsedTime;

  createBloodParticle(point, normal, npc);

  if (npc.health <= 0) {
    killNPC(npc);
  } else {
    playNpcPainSound();
    if (Math.random() < 0.3) {
      npc.limpTimer = CONFIG.painWrithingDuration;
    }
    if (Math.random() < 0.2) {
      npc.stumbleTimer = THREE.MathUtils.lerp(CONFIG.stumbleDurationMin, CONFIG.stumbleDurationMax, Math.random());
    }
  }
}

function killNPC(npc) {
  if (!npc.alive) return;
  npc.alive = false;
  npc.deathElapsed = 0;
  npc.hitTimer = 0;

  enableNPCRagdoll(npc);

  playNpcDeathSound();
}

function enableNPCRagdoll(npc) {
  console.log('Enabling ragdoll for NPC');
}

function createBloodParticle(point, normal, owner) {
  if (!state.bloodEffectsEnabled) return;
  const particle = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 4, 4),
    new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.9, metalness: 0.0 })
  );
  particle.position.copy(point);
  particle.velocity = new THREE.Vector3(
    (Math.random() - 0.5) * 0.5,
    (Math.random() - 0.5) * 0.5,
    (Math.random() - 0.5) * 0.5
  );
  particle.life = CONFIG.bloodParticleLifetime;
  particle.owner = owner;
  state.bloodParticles.push(particle);
  state.scene.add(particle);
  if (state.bloodParticles.length > MAX_BLOOD_PARTICLES) {
    const old = state.bloodParticles.shift();
    state.scene.remove(old);
    old.geometry.dispose();
    old.material.dispose();
  }
}

function playNpcPainSound() {
  console.log('NPC pain sound would play here');
}

function playNpcDeathSound() {
  console.log('NPC death sound would play here');
}

function updateNpcBleeding(npc, dt) {
  if (!npc.alive && npc.deathElapsed > 3) return;

  if (!npc.bleedWounds || npc.bleedWounds.length === 0) return;
  for (let i = npc.bleedWounds.length - 1; i >= 0; i--) {
    const wound = npc.bleedWounds[i];
    wound.timer -= dt;
    if (wound.remaining <= 0) {
      npc.bleedWounds.splice(i, 1);
      continue;
    }
    if (wound.timer > 0) continue;
    const sourceMesh = npc.model.parts[wound.part] || npc.model.parts.torso;
    if (!sourceMesh) {
      npc.bleedWounds.splice(i, 1);
      continue;
    }
    sourceMesh.updateWorldMatrix(true, false);
    const worldPosition = sourceMesh.localToWorld(wound.localPoint.clone());
    spawnBleedDrop(worldPosition, npc, wound.severity);
    wound.remaining--;
    const movementSpeed = npc.alive ? Math.hypot(npc.velocityX || 0, npc.velocityZ || 0) : 0;
    wound.timer = THREE.MathUtils.clamp(0.52 - movementSpeed * 0.045, 0.20, 0.58) + Math.random() * 0.22;
  }
}

export {
  spawnNPC,
  clearNpcs,
  updateNpcs,
  updateNpcAI,
  chooseNpcWanderTarget,
  updateNpcAnimation,
  updateNpcWeapon,
  fireNpcWeaponAtPlayer,
  createNpcMuzzleFlash,
  playNpcGunshotSound,
  applyNpcRecoil,
  getNpcWeaponCooldown,
  updateNpcHitEffects,
  hitNPC,
  killNPC,
  enableNPCRagdoll,
  updateNpcBleeding,
  createBloodParticle,
  playNpcPainSound,
  playNpcDeathSound
};