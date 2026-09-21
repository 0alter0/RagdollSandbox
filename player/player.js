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

function getPlayerDesertCamoTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#4a5d23';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 300; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 15 + Math.random() * 40;
    const a = 0.05 + Math.random() * 0.15;
    ctx.fillStyle = `rgba(101,118,65,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const dark = Math.random() < 0.5;
    const a = dark ? 0.02 + Math.random() * 0.08 : 0.015 + Math.random() * 0.07;
    ctx.fillStyle = dark
      ? `rgba(60,75,35,${a})`
      : `rgba(200,215,170,${a})`;
    const r = 0.3 + Math.random() * 1.2;
    ctx.fillRect(x, y, r, r);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function addGearMesh(geo, mat, offset, rotation, scale, parent) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(offset);
  mesh.rotation.copy(rotation);
  mesh.scale.copy(scale);
  parent.add(mesh);
  return mesh;
}

function applyPlayerMilitaryGear(playerObj) {
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });

  const helmetGeo = new THREE.CapsuleGeometry(0.08, 0.22, 4, 8);
  helmetGeo.translate(0, 0.22 + 0.08, 0);
  addGearMesh(helmetGeo, mat(0x2b2320), new THREE.Vector3(0, BONE.torsoLen + BONE.headR + 0.02, 0), new THREE.Euler(0, 0, 0), new THREE.Vector3(1, 1, 1), playerObj.helmet);

  const vestGeo = new THREE.BoxGeometry(BONE.shoulderX * 2.2, BONE.torsoLen * 0.9, BONE.shoulderX * 1.1);
  vestGeo.translate(0, BONE.torsoLen * 0.45, 0);
  addGearMesh(vestGeo, mat(0x2b2320), new THREE.Vector3(0, BONE.torsoLen * 0.5, 0), new THREE.Euler(0, 0, 0), new THREE.Vector3(1, 1, 1), playerObj.vest);

  const kneePadGeo = new THREE.TorusGeometry(0.04, 0.015, 3, 8);
  kneePadGeo.rotateX(Math.PI / 2);
  addGearMesh(kneePadGeo, mat(0x2b2320), new THREE.Vector3(-BONE.hipX, -BONE.torsoLen - BONE.thighLen * 0.5, 0), new THREE.Euler(Math.PI / 2, 0, 0), new THREE.Vector3(1, 1, 1), playerObj.kneePadLeft);
  addGearMesh(kneePadGeo, mat(0x2b2320), new THREE.Vector3(BONE.hipX, -BONE.torsoLen - BONE.thighLen * 0.5, 0), new THREE.Euler(Math.PI / 2, 0, 0), new THREE.Vector3(1, 1, 1), playerObj.kneePadRight);

  const elbowPadGeo = new THREE.SphereGeometry(0.03, 4, 4);
  addGearMesh(elbowPadGeo, mat(0x2b2320), new THREE.Vector3(-BONE.shoulderX - BONE.upperArmLen * 0.5, BONE.torsoLen * 0.2, 0), new THREE.Euler(0, 0, 0), new THREE.Vector3(1, 1, 1), playerObj.elbowPadLeft);
  addGearMesh(elbowPadGeo, mat(0x2b2320), new THREE.Vector3(BONE.shoulderX + BONE.upperArmLen * 0.5, BONE.torsoLen * 0.2, 0), new THREE.Euler(0, 0, 0), new THREE.Vector3(1, 1, 1), playerObj.elbowPadRight);

  const bootGeo = new THREE.CapsuleGeometry(0.09, 0.25, 4, 8);
  bootGeo.translate(0, 0.25 / 2, 0);
  addGearMesh(bootGeo, mat(0x1a1a1a), new THREE.Vector3(-BONE.hipX, -BONE.torsoLen - BONE.thighLen - BONE.shinLen - 0.05, 0), new THREE.Euler(0, 0, 0), new THREE.Vector3(1, 0.9, 1), playerObj.bootLeft);
  addGearMesh(bootGeo, mat(0x1a1a1a), new THREE.Vector3(BONE.hipX, -BONE.torsoLen - BONE.thighLen - BONE.shinLen - 0.05, 0), new THREE.Euler(0, 0, 0), new THREE.Vector3(1, 0.9, 1), playerObj.bootRight);
}

function buildPlayer() {
  state.player = new THREE.Group();
  state.player.name = 'Player';

  const torsoGeo = new THREE.CylinderGeometry(BONE.torsoR, BONE.torsoR, BONE.torsoLen, 8);
  torsoGeo.translate(0, BONE.torsoLen / 2, 0);
  const torsoMat = new THREE.MeshStandardMaterial({ color: SHIRT_COLOR, roughness: 0.8, metalness: 0.1 });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.castShadow = true;
  torso.receiveShadow = true;
  state.player.add(torso);

  const headGeo = new THREE.SphereGeometry(BONE.headR, 12, 12);
  headGeo.translate(0, BONE.torsoLen + BONE.headR, 0);
  const headMat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 0.85, metalness: 0.0 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.castShadow = true;
  head.receiveShadow = true;
  state.player.add(head);

  const pelvisGeo = new THREE.SphereGeometry(BONE.torsoR * 1.1, 8, 8);
  pelvisGeo.translate(0, 0, 0);
  const pelvisMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9, metalness: 0.0 });
  const pelvis = new THREE.Mesh(pelvisGeo, pelvisMat);
  pelvis.castShadow = true;
  pelvis.receiveShadow = true;
  state.player.add(pelvis);

  const upperArmGeo = new THREE.CylinderGeometry(BONE.upperArmR, BONE.upperArmR, BONE.upperArmLen, 6);
  upperArmGeo.translate(0, BONE.upperArmLen / 2, 0);
  const upperArmMat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 0.85, metalness: 0.0 });
  const leftUpperArm = new THREE.Mesh(upperArmGeo, upperArmMat);
  leftUpperArm.position.set(-BONE.shoulderX, BONE.torsoLen, 0);
  leftUpperArm.castShadow = true;
  leftUpperArm.receiveShadow = true;
  state.player.add(leftUpperArm);
  const rightUpperArm = new THREE.Mesh(upperArmGeo, upperArmMat);
  rightUpperArm.position.set(BONE.shoulderX, BONE.torsoLen, 0);
  rightUpperArm.castShadow = true;
  rightUpperArm.receiveShadow = true;
  state.player.add(rightUpperArm);

  const forearmGeo = new THREE.CylinderGeometry(BONE.forearmR, BONE.forearmR, BONE.forearmLen, 6);
  forearmGeo.translate(0, BONE.forearmLen / 2, 0);
  const forearmMat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 0.85, metalness: 0.0 });
  const leftForearm = new THREE.Mesh(forearmGeo, forearmMat);
  leftForearm.position.set(-BONE.shoulderX - BONE.upperArmLen, BONE.torsoLen - BONE.upperArmLen / 2, 0);
  leftForearm.rotation.z = -Math.PI / 6;
  leftForearm.castShadow = true;
  leftForearm.receiveShadow = true;
  state.player.add(leftForearm);
  const rightForearm = new THREE.Mesh(forearmGeo, forearmMat);
  rightForearm.position.set(BONE.shoulderX + BONE.upperArmLen, BONE.torsoLen - BONE.upperArmLen / 2, 0);
  rightForearm.rotation.z = Math.PI / 6;
  rightForearm.castShadow = true;
  rightForearm.receiveShadow = true;
  state.player.add(rightForearm);

  const handGeo = new THREE.BoxGeometry(BONE.handR * 2, BONE.handR, BONE.handR * 0.6);
  handGeo.translate(0, 0, 0);
  const handMat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 0.85, metalness: 0.0 });
  const leftHand = new THREE.Mesh(handGeo, handMat);
  leftHand.position.set(-BONE.shoulderX - BONE.upperArmLen - BONE.forearmLen, BONE.torsoLen - BONE.upperArmLen / 2 - BONE.forearmLen / 2, 0);
  leftHand.castShadow = true;
  leftHand.receiveShadow = true;
  state.player.add(leftHand);
  const rightHand = new THREE.Mesh(handGeo, handMat);
  rightHand.position.set(BONE.shoulderX + BONE.upperArmLen + BONE.forearmLen, BONE.torsoLen - BONE.upperArmLen / 2 - BONE.forearmLen / 2, 0);
  rightHand.castShadow = true;
  rightHand.receiveShadow = true;
  state.player.add(rightHand);

  const thighGeo = new THREE.CylinderGeometry(BONE.thighR, BONE.thighR, BONE.thighLen, 6);
  thighGeo.translate(0, BONE.thighLen / 2, 0);
  const thighMat = new THREE.MeshStandardMaterial({ color: JEANS_COLOR, roughness: 0.9, metalness: 0.0 });
  const leftThigh = new THREE.Mesh(thighGeo, thighMat);
  leftThigh.position.set(-BONE.hipX, -BONE.torsoLen / 2, 0);
  leftThigh.castShadow = true;
  leftThigh.receiveShadow = true;
  state.player.add(leftThigh);
  const rightThigh = new THREE.Mesh(thighGeo, thighMat);
  rightThigh.position.set(BONE.hipX, -BONE.torsoLen / 2, 0);
  rightThigh.castShadow = true;
  rightThigh.receiveShadow = true;
  state.player.add(rightThigh);

  const shinGeo = new THREE.CylinderGeometry(BONE.shinR, BONE.shinR, BONE.shinLen, 6);
  shinGeo.translate(0, BONE.shinLen / 2, 0);
  const shinMat = new THREE.MeshStandardMaterial({ color: JEANS_COLOR, roughness: 0.9, metalness: 0.0 });
  const leftShin = new THREE.Mesh(shinGeo, shinMat);
  leftShin.position.set(-BONE.hipX, -BONE.torsoLen - BONE.thighLen / 2, 0);
  leftShin.castShadow = true;
  leftShin.receiveShadow = true;
  state.player.add(leftShin);
  const rightShin = new THREE.Mesh(shinGeo, shinMat);
  rightShin.position.set(BONE.hipX, -BONE.torsoLen - BONE.thighLen / 2, 0);
  rightShin.castShadow = true;
  rightShin.receiveShadow = true;
  state.player.add(rightShin);

  const footGeo = new THREE.BoxGeometry(BONE.shinR * 2.2, BONE.shinR * 0.6, BONE.shinR * 2.8);
  footGeo.translate(0, -BONE.shinR * 0.3, 0);
  const footMat = new THREE.MeshStandardMaterial({ color: SHOE_COLOR, roughness: 0.9, metalness: 0.0 });
  const leftFoot = new THREE.Mesh(footGeo, footMat);
  leftFoot.position.set(-BONE.hipX, -BONE.torsoLen - BONE.thighLen - BONE.shinLen, 0);
  leftFoot.castShadow = true;
  leftFoot.receiveShadow = true;
  state.player.add(leftFoot);
  const rightFoot = new THREE.Mesh(footGeo, footMat);
  rightFoot.position.set(BONE.hipX, -BONE.torsoLen - BONE.thighLen - BONE.shinLen, 0);
  rightFoot.castShadow = true;
  rightFoot.receiveShadow = true;
  state.player.add(rightFoot);

  applyPlayerMilitaryGear(state.player);

  state.scene.add(state.player);

  state.player.velocity = new THREE.Vector3();
  state.player.direction = new THREE.Vector3();
  state.player.rotation = new THREE.Euler(0, 0, 0);
  state.player.weapon = 'pistol';
  state.player.ammo = CONFIG.magSize;
  state.player.health = 100;
  state.player.maxHealth = 100;
  state.player.alive = true;
  state.player.invulnerable = false;
  state.player.sprinting = false;
  state.player.aiming = false;
  state.player.reloading = false;
  state.player.reloadTimer = 0;
  state.player.fireTimer = 0;
  state.player.hitTimer = 0;
  state.player.deathElapsed = 0;
  state.player.lastHitTime = 0;
  state.player.walkTimer = 0;
  state.player.headBobOffset = 0;
  state.player.headBobPhase = 0;
  state.player.crouching = false;
  state.player.crouchHeight = 0;
  state.player.targetCrouchHeight = 0;
  state.player.crouchSpeed = 5;

  state.player.position.set(0, 0, 0);
  state.player.updateMatrixWorld(true);
}

function setFirstPersonMode(enabled) {
  if (enabled) {
    state.player.traverse((child) => {
      if (child.isMesh) child.visible = false;
    });
  } else {
    state.player.traverse((child) => {
      if (child.isMesh) child.visible = true;
    });
  }
}

function getActiveWeapon() {
  const weaponType = (state.player && state.player.weapon) ? state.player.weapon : 'pistol';
  // most likely will be revamped when animations and weapon models are added
  const weaponStats = {
    pistol: {
      name: '9mm Pistol',
      magSize: 12,
      fireCooldown: 0.14,
      recoil: 0.030,
      kick: 0.085,
      muzzleSize: 0.28
    },
    shotgun: {
      name: '12 Gauge Shotgun',
      magSize: 6,
      fireCooldown: 0.4,
      recoil: 0.15,
      kick: 0.25,
      muzzleSize: 0.5
    },
    ak: {
      name: 'AK-47',
      magSize: 30,
      fireCooldown: 0.1,
      recoil: 0.05,
      kick: 0.12,
      muzzleSize: 0.35
    }
  };
  return weaponStats[weaponType] || weaponStats.pistol;
}

function updateMuzzleAttachment() {
  if (!state.player) return;
  let rightHand = null;
  state.player.traverse((child) => {
    if (child.isMesh && child.name === 'rightHand') {
      rightHand = child;
    }
  });
  if (!rightHand) return;

  if (state.player.muzzleFlash) {
    state.player.remove(state.player.muzzleFlash);
    state.player.muzzleFlash.geometry.dispose();
    state.player.muzzleFlash.material.dispose();
  }

  const muzzleGeo = new THREE.SphereGeometry(0.02, 8, 8);
  const muzzleMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
  const muzzleFlash = new THREE.Mesh(muzzleGeo, muzzleMat);
  muzzleFlash.position.set(0, 0, 0);
  muzzleFlash.visible = false;
  rightHand.add(muzzleFlash);
  state.player.muzzleFlash = muzzleFlash;
}

function solvePlayerArmToTarget() {
  if (!state.player) return;
  let rightHand = null;
  state.player.traverse((child) => {
    if (child.isMesh && child.name === 'rightHand') {
      rightHand = child;
    }
  });
  if (!rightHand) return;
  const target = new THREE.Vector3();
  target.set(0, 0, 0);

  const handPos = new THREE.Vector3();
  rightHand.getWorldPosition(handPos);
  const direction = new THREE.Vector3().subVectors(target, handPos).normalize();
  const armGroup = new THREE.Object3D();
  armGroup.position.copy(handPos);
  armGroup.lookAt(target);
  let rightForearm = null;
  let rightHandMesh = null;
  state.player.traverse((child) => {
    if (child.isMesh && child.name === 'rightForearm') {
      rightForearm = child;
    }
    if (child.isMesh && child.name === 'rightHand') {
      rightHandMesh = child;
    }
  });
  if (rightForearm) {
    rightForearm.rotation.set(armGroup.rotation.x, armGroup.rotation.y, rightForearm.rotation.z);
  }
  if (rightHandMesh) {
    rightHandMesh.rotation.set(armGroup.rotation.x, armGroup.rotation.y, rightHandMesh.rotation.z);
  }
}

function resetPlayerHandOrientation() {
  if (!state.player) return;
  let rightHand = null;
  let rightForearm = null;
  state.player.traverse((child) => {
    if (child.isMesh && child.name === 'rightHand') {
      rightHand = child;
    }
    if (child.isMesh && child.name === 'rightForearm') {
      rightForearm = child;
    }
  });
  if (rightHand) {
    rightHand.rotation.set(0, 0, 0);
  }
  if (rightForearm) {
    rightForearm.rotation.set(0, 0, 0);
  }
}

function makeStableAimQuaternion() {
  return new THREE.Quaternion();
}

function setHandWorldQuaternion(quat) {
  if (!state.player) return;
  let rightHand = null;
  state.player.traverse((child) => {
    if (child.isMesh && child.name === 'rightHand') {
      rightHand = child;
    }
  });
  if (rightHand) {
    rightHand.quaternion.copy(quat);
  }
}

function applyPlayerWalkAnimation() {
  if (!state.player || !state.player.alive) return;
  const walkSpeed = state.player.sprinting ? CONFIG.walkSpeed * CONFIG.sprintMult : CONFIG.walkSpeed;
  const delta = state.clock.getDelta();
  state.player.walkTimer += delta * walkSpeed * 2;

  const bobAmount = 0.015 * (state.player.sprinting ? 1.5 : 1);
  state.player.position.y = Math.sin(state.player.walkTimer) * bobAmount + (state.player.crouching ? state.player.targetCrouchHeight : 0);

  const swayAmount = 0.005 * (state.player.sprinting ? 1.5 : 1);
  state.player.position.x = Math.sin(state.player.walkTimer * 0.5) * swayAmount;
  state.player.position.z = Math.cos(state.player.walkTimer * 0.5) * swayAmount;

  if (CONFIG.headBobEnabled) {
    state.player.headBobOffset = Math.sin(state.player.walkTimer) * CONFIG.headBobStrength * (state.player.sprinting ? 1.5 : 1);
    state.player.traverse((child) => {
      if (child.isMesh && child.name === 'head') {
        child.position.y = state.player.headBobOffset;
      }
    });
  }
}

function updatePlayer() {
  if (!state.player) return;
  if (state.player.alive) {
    if (state.player.reloadTimer > 0) {
      state.player.reloadTimer -= state.deltaTime;
      if (state.player.reloadTimer <= 0) {
        state.player.reloadTimer = 0;
        state.player.reloading = false;
        state.player.ammo = CONFIG.magSize;
      }
    }
    if (state.player.fireTimer > 0) {
      state.player.fireTimer -= state.deltaTime;
    }
    if (state.player.hitTimer > 0) {
      state.player.hitTimer -= state.deltaTime;
    }
    if (state.player.hitTimer > 0) {
      state.player.invulnerable = true;
    } else {
      state.player.invulnerable = false;
    }
    if (state.player.crouching) {
      state.player.targetCrouchHeight = -0.3; // Crouch height
    } else {
      state.player.targetCrouchHeight = 0;
    }
    state.player.crouchHeight += (state.player.targetCrouchHeight - state.player.crouchHeight) * state.deltaTime * state.player.crouchSpeed;

    const input = state.input; // Assuming input module sets state.input
    const moveForward = input.keys['KeyW'] || input.keys['ArrowUp'];
    const moveBackward = input.keys['KeyS'] || input.keys['ArrowDown'];
    const moveLeft = input.keys['KeyA'] || input.keys['ArrowLeft'];
    const moveRight = input.keys['KeyD'] || input.keys['ArrowRight'];
    const sprint = input.keys['ShiftLeft'] || input.keys['ShiftRight'];

    const speed = state.player.sprinting ? CONFIG.walkSpeed * CONFIG.sprintMult : CONFIG.walkSpeed;
    state.player.velocity.set(0, 0, 0);
    if (moveForward) state.player.velocity.z -= speed * state.deltaTime;
    if (moveBackward) state.player.velocity.z += speed * state.deltaTime;
    if (moveLeft) state.player.velocity.x -= speed * state.deltaTime;
    if (moveRight) state.player.velocity.x += speed * state.deltaTime;

    state.player.position.add(state.player.velocity);

    state.player.sprinting = sprint && (moveForward || moveBackward || moveLeft || moveRight);

    state.player.aiming = input.mouseDownRight;

    if (input.keys['KeyR'] && !state.player.reloading && state.player.ammo < CONFIG.magSize && !state.player.sprinting) {
      state.player.reloading = true;
      state.player.reloadTimer = CONFIG.reloadTime;
      state.player.fireTimer = 0; // Cancel firing
    }

    if (input.mouseDownLeft && !state.player.reloading && state.player.ammo > 0 && state.player.fireTimer <= 0) {
      fireWeapon();
      state.player.fireTimer = getActiveWeapon().fireCooldown;
      state.player.ammo--;
    }

    state.player.walkTimer += state.deltaTime * (state.player.sprinting ? 2 : 1);
  } else {
    state.player.deathElapsed += state.deltaTime; // funny because this state will most likely never happen in the current game, but it's here for future use
  }
}

function fireWeapon() {
  if (!state.player) return;
  if (state.player.muzzleFlash) {
    state.player.muzzleFlash.visible = true;
    setTimeout(() => {
      if (state.player.muzzleFlash) {
        state.player.muzzleFlash.visible = false;
      }
    }, 50);
  }

  createShellCasing();

  playGunshotSound();

  applyRecoil();

  raycastForHit();
}

function createShellCasing() {
  if (!state.player) return;
  let muzzlePos = new THREE.Vector3(0, 0, 0);
  state.player.traverse((child) => {
    if (child.isMesh && child.name === 'rightHand') {
      child.getWorldPosition(muzzlePos);
    }
  });
  const casing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.03, 8),
    new THREE.MeshStandardMaterial({ color: 0x5a4326, roughness: 0.4, metalness: 0.8 })
  );
  casing.position.copy(muzzlePos);
  casing.position.x += 0.1; 
  casing.position.y += 0.05;
  casing.rotation.set(Math.PI / 2, Math.random() * Math.PI, 0);
  casing.castShadow = true;
  casing.receiveShadow = true;
  state.scene.add(casing);
  state.shellCasings.push(casing);
  if (state.shellCasings.length > MAX_SHELL_CASINGS) {
    const old = state.shellCasings.shift();
    state.scene.remove(old);
    old.geometry.dispose();
    old.material.dispose();
  }
}

function playGunshotSound() {
  console.log('Gunshot sound would play here');
}

function applyRecoil() {
  if (!state.player) return;
  const weapon = getActiveWeapon();
  state.camera.rotation.x -= weapon.recoil * 0.02; // Adjust as needed
  state.camera.position.z += weapon.kick * 0.05;
  setTimeout(() => {
    state.camera.rotation.x += weapon.recoil * 0.02;
    state.camera.position.z -= weapon.kick * 0.05;
  }, CONFIG.recoilRecovery * 100);
}

function raycastForHit() {
  if (!state.player) return;
  const raycaster = state.raycaster;
  const mouse = state.mouse;
  raycaster.setFromCamera(mouse, state.camera);
  const intersects = raycaster.intersectObjects(state.rayTargets, true);
  if (intersects.length > 0) {
    const hit = intersects[0];
    let npc = null;
    state.npcs.forEach((n) => {
      if (n.threeGroup && n.threeGroup.visible) {
        if (n.threeGroup.contains(hit.object)) {
          npc = n;
        }
      }
    });
    if (npc) {
      hitNPC(npc, hit.point, hit.normal);
    } else {
      createBulletHole(hit.point, hit.normal, hit.object.material);
      createImpactEffect(hit.point, hit.normal);
    }
  }
}

function hitNPC(npc, point, normal) {
  if (!npc.alive) return;
  npc.health -= 20; // should this be raised?
  if (npc.health <= 0) {
    killNPC(npc);
  } else {
    createBloodParticle(point, normal, npc);
    playNPCPainSound();
  }
}

function killNPC(npc) {
  if (!npc.alive) return;
  npc.alive = false;
  npc.deathElapsed = 0;
  enableNPCRagdoll(npc);
  playNPCDeathSound();
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

function createBulletHole(point, normal, material) {
  if (!CONFIG.bulletHolesEnabled) return;
  const decalGeo = new THREE.PlaneGeometry(0.05, 0.05);
  const decalMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  const decal = new THREE.Mesh(decalGeo, decalMat);
  decal.position.copy(point);
  decal.lookAt(point.clone().add(normal));
  decal.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI);
  decal.renderOrder = 1;
  state.scene.add(decal);
  state.bulletHoles.push(decal);
  if (state.bulletHoles.length > CONFIG.bulletHoleCap) {
    const old = state.bulletHoles.shift();
    state.scene.remove(old);
    old.geometry.dispose();
    old.material.dispose();
  }
}

function createImpactEffect(point, normal) {
  console.log('Impact effect at', point);
}

function playNPCPainSound() {
  console.log('NPC pain sound would play here');
}

function playNPCDeathSound() {
  console.log('NPC death sound would play here');
}

export {
  buildPlayer,
  setFirstPersonMode,
  getActiveWeapon,
  updateMuzzleAttachment,
  solvePlayerArmToTarget,
  resetPlayerHandOrientation,
  makeStableAimQuaternion,
  setHandWorldQuaternion,
  applyPlayerWalkAnimation,
  updatePlayer,
  fireWeapon,
  createShellCasing,
  playGunshotSound,
  applyRecoil,
  raycastForHit,
  hitNPC,
  killNPC,
  enableNPCRagdoll,
  createBloodParticle,
  createBulletHole,
  createImpactEffect,
  playNPCPainSound,
  playNPCDeathSound
};