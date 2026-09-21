import { CONFIG, BONE, GROUP_GROUND, GROUP_RAGDOLL, GROUP_SHELL, MAX_BLOOD_PARTICLES, MAX_BLOOD_DECALS, MAX_BLOOD_POOLS, MAX_BLOOD_LANDING_DOTS, MAX_SHELL_CASINGS, SKIN_COLOR, SHIRT_COLOR, NPC_SHIRT_COLORS, JEANS_COLOR, SHOE_COLOR, BELT_COLOR } from '../config/config.js';
import { state } from '../state.js';

// Helper functions (unchanged)
function cellKey(x, z) { return x + ',' + z; }
function doorKeyOf(a, b) {
  const [p, q] = (a.x < b.x || (a.x === b.x && a.z < b.z)) ? [a, b] : [b, a];
  return cellKey(p.x, p.z) + '|' + cellKey(q.x, q.z);
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

// Building generation functions (unchanged except for using state and config)
function generateBuildingLayout() {
  const cells = new Set();
  const doors = new Set();
  const start = { x: 0, z: 0 };
  cells.add(cellKey(0, 0));
  const spread = Math.max(0, Math.floor(CONFIG.buildingRoomTarget * 0.3));
  const targetCount = Math.max(3, CONFIG.buildingRoomTarget + Math.floor((Math.random() * 2 - 1) * spread));
  let frontier = [start];
  let guard = 0;
  while (cells.size < targetCount && frontier.length && guard < 400) {
    guard++;
    const idx = Math.floor(Math.random() * frontier.length);
    const base = frontier[idx];
    let grew = false;
    for (const d of shuffleArr(BUILDING_DIRS)) {
      const nx = base.x + d.dx, nz = base.z + d.dz;
      const k = cellKey(nx, nz);
      if (cells.has(k)) continue;
      cells.add(k);
      doors.add(doorKeyOf(base, { x: nx, z: nz }));
      frontier.push({ x: nx, z: nz });
      grew = true;
      break;
    }
    if (!grew) frontier.splice(idx, 1);
  }
  for (const ck of cells) {
    const [cx, cz] = ck.split(',').map(Number);
    for (const d of BUILDING_DIRS) {
      if (d.dx < 0 || (d.dx === 0 && d.dz < 0)) continue;
      const nx = cx + d.dx, nz = cz + d.dz;
      const nk = cellKey(nx, nz);
      if (!cells.has(nk)) continue;
      const dk = doorKeyOf({ x: cx, z: cz }, { x: nx, z: nz });
      if (!doors.has(dk) && Math.random() < 0.16) doors.add(dk);
    }
  }

  const degree = new Map();
  for (const ck of cells) degree.set(ck, 0);
  for (const dk of doors) {
    const [a, b] = dk.split('|');
    degree.set(a, (degree.get(a) || 0) + 1);
    degree.set(b, (degree.get(b) || 0) + 1);
  }

  return { cells, doors, start, degree };
}

function assignBuildingRoles(layout) {
  const roles = new Map();
  const startKey = cellKey(layout.start.x, layout.start.z);
  for (const ck of layout.cells) {
    if (ck === startKey) { roles.set(ck, 'entrance'); continue; }
    const deg = layout.degree.get(ck) || 0;
    if (deg >= 3) { roles.set(ck, 'hall'); continue; }
    if (deg === 1) {
      const roll = Math.random();
      roles.set(ck, roll < 0.32 ? 'tower' : roll < 0.5 ? 'courtyard' : 'room');
      continue;
    }
    roles.set(ck, 'room');
  }
  return roles;
}

function estimateBuildingRadius(layout) {
  let maxDist = 0;
  for (const ck of layout.cells) {
    const [gx, gz] = ck.split(',').map(Number);
    const d = Math.hypot(gx * BUILDING_CELL, gz * BUILDING_CELL);
    if (d > maxDist) maxDist = d;
  }
  return maxDist + BUILDING_CELL * 0.85;
}

function buildingLocalToWorld(center, rot, lx, lz) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return { x: center.x + lx * c + lz * s, z: center.z - lx * s + lz * c };
}

function addBuildingWallSegment(cx, cz, w, d, h, rotation, color) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 + Math.random() * 0.06, metalness: 0.0 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(cx, h / 2, cz);
  mesh.rotation.y = rotation;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  state.scene.add(mesh);
  state.rayTargets.push(mesh);
  state.environmentMeshes.push(mesh);
  const obstacleRef = { x: cx, z: cz, w, d, h, mesh, cover: true, rotation };
  state.environmentObstacles.push(obstacleRef);
  let body = null;
  if (state.world) {
    body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)), material: state.groundMaterial });
    body.position.set(cx, h / 2, cz);
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotation);
    body.collisionFilterGroup = GROUP_GROUND;
    body.collisionFilterMask = GROUP_GROUND | GROUP_RAGDOLL | GROUP_SHELL;
    state.world.addBody(body);
  }
  state.buildingParts.push({ mesh, body, obstacleRef });
  return mesh;
}

function addBuildingDecor(cx, cz, w, d, h, baseY, rotation, color, opts) {
  opts = opts || {};
  const matOpts = { color, roughness: opts.roughness ?? 0.85, metalness: opts.metalness ?? 0.0 };
  if (opts.emissive) { matOpts.emissive = opts.emissive; matOpts.emissiveIntensity = opts.emissiveIntensity ?? 1.0; }
  const mat = new THREE.MeshStandardMaterial(matOpts);
  const geo = opts.geometry || new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, baseY + h / 2, cz);
  if (opts.rotationX) mesh.rotation.x = opts.rotationX;
  mesh.rotation.y = rotation + (opts.extraYaw || 0);
  mesh.castShadow = opts.castShadow !== false;
  mesh.receiveShadow = true;
  state.scene.add(mesh);
  if (opts.blockBullets !== false) state.rayTargets.push(mesh);
  state.buildingParts.push({ mesh, body: null, obstacleRef: null });
  return mesh;
}

function addBuildingPitchedRoof(cx, cz, span, baseY, rotation, color) {
  const geo = new THREE.ConeGeometry(span * 0.74, span * 0.42, 4);
  addBuildingDecor(cx, cz, span, span, span * 0.42, baseY, rotation, color, {
    geometry: geo, extraYaw: Math.PI / 4, roughness: 0.82
  });
}

function maybeAddWindowPane(cx, cz, w, d, rotation, style) {
  if (Math.random() >= style.windowChance) return;
  const wallIsLongX = w >= d;
  const longLen = Math.max(w, d);
  if (longLen < BUILDING_CELL * 0.5) return;
  const paneLen = longLen * 0.42;
  const outward = BUILDING_WALL_T / 2 + 0.03;
  const nx = wallIsLongX ? Math.sin(rotation) : Math.cos(rotation);
  const nz = wallIsLongX ? Math.cos(rotation) : -Math.sin(rotation);
  const paneW = wallIsLongX ? paneLen : BUILDING_WALL_T + 0.06;
  const paneD = wallIsLongX ? BUILDING_WALL_T + 0.06 : paneLen;
  addBuildingDecor(cx + nx * outward, cz + nz * outward, paneW, paneD, 0.95, 1.35, rotation, 0x1e2c33, {
    roughness: 0.15, metalness: 0.35, castShadow: false
  });
}

function buildBuildingWallSide(gx, gz, d, center, rot, carveDoor, style, allowRuin, protectedSet) {
  const cellLX = gx * BUILDING_CELL, cellLZ = gz * BUILDING_CELL;
  const boundLX = cellLX + d.dx * (BUILDING_CELL / 2);
  const boundLZ = cellLZ + d.dz * (BUILDING_CELL / 2);
  const runAlongX = d.dz !== 0;
  const sideKey = cellKey(gx, gz) + '#' + d.dx + ',' + d.dz;

  if (!carveDoor) {
    if (allowRuin && style.ruinChance > 0 && !protectedSet.has(sideKey) && Math.random() < style.ruinChance) return;
    const w = runAlongX ? BUILDING_CELL : BUILDING_WALL_T;
    const dd = runAlongX ? BUILDING_WALL_T : BUILDING_CELL;
    const wp = buildingLocalToWorld(center, rot, boundLX, boundLZ);
    const wallColor = pick(style.wall);
    addBuildingWallSegment(wp.x, wp.z, w, dd, BUILDING_WALL_H, rot, wallColor);
    maybeAddWindowPane(wp.x, wp.z, w, dd, rot, style);
    return;
  }

  const flankLen = (BUILDING_CELL - BUILDING_DOOR_W) / 2;
  const off = BUILDING_DOOR_W / 2 + flankLen / 2;
  const wallColor = pick(style.wall);
  if (runAlongX) {
    const p1 = buildingLocalToWorld(center, rot, boundLX - off, boundLZ);
    const p2 = buildingLocalToWorld(center, rot, boundLX + off, boundLZ);
    addBuildingWallSegment(p1.x, p1.z, flankLen, BUILDING_WALL_T, BUILDING_WALL_H, rot, wallColor);
    addBuildingWallSegment(p2.x, p2.z, flankLen, BUILDING_WALL_T, BUILDING_WALL_H, rot, wallColor);
  } else {
    const p1 = buildingLocalToWorld(center, rot, boundLX, boundLZ - off);
    const p2 = buildingLocalToWorld(center, rot, boundLX, boundLZ + off);
    addBuildingWallSegment(p1.x, p1.z, BUILDING_WALL_T, flankLen, BUILDING_WALL_H, rot, wallColor);
    addBuildingWallSegment(p2.x, p2.z, BUILDING_WALL_T, flankLen, BUILDING_WALL_H, rot, wallColor);
  }
  const headerH = BUILDING_WALL_H - BUILDING_DOOR_H;
  const hp = buildingLocalToWorld(center, rot, boundLX, boundLZ);
  const hw = runAlongX ? BUILDING_DOOR_W : BUILDING_WALL_T;
  const hd = runAlongX ? BUILDING_WALL_T : BUILDING_DOOR_W;
  addBuildingDecor(hp.x, hp.z, hw, hd, headerH, BUILDING_DOOR_H, rot, style.trim, { roughness: 0.88 });
}

function addBuildingCornerPosts(gx, gz, center, rot, style, postH) {
  const half = BUILDING_CELL / 2 + BUILDING_WALL_T * 0.15;
  const corners = [[-half, -half], [half, -half], [half, half], [-half, half]];
  const cellLX = gx * BUILDING_CELL, cellLZ = gz * BUILDING_CELL;
  for (const [ox, oz] of corners) {
    const wp = buildingLocalToWorld(center, rot, cellLX + ox, cellLZ + oz);
    addBuildingDecor(wp.x, wp.z, 0.32, 0.32, postH, 0, rot, style.pillar, { roughness: 0.8 });
  }
}

function addBuildingClutter(gx, gz, center, rot, style) {
  const count = Math.random() < 0.55 ? (Math.random() < 0.3 ? 2 : 1) : 0;
  const cellLX = gx * BUILDING_CELL, cellLZ = gz * BUILDING_CELL;
  const safeR = BUILDING_CELL * 0.28;
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = Math.random() * safeR;
    const lx = cellLX + Math.cos(ang) * r, lz = cellLZ + Math.sin(ang) * r;
    const wp = buildingLocalToWorld(center, rot, lx, lz);
    const s = 0.55 + Math.random() * 0.3;
    addBuildingDecor(wp.x, wp.z, s, s, s, 0.03, rot + Math.random() * Math.PI, pick([0x6b5a3f, 0x5a4b34, 0x746148]), { roughness: 0.95 });
  }
}

function buildBuildingFromLayout(layout, center, rot, style) {
  const roles = assignBuildingRoles(layout);

  let entranceDir = null;
  const entranceCandidates = BUILDING_DIRS.filter(d =>
    !layout.cells.has(cellKey(layout.start.x + d.dx, layout.start.z + d.dz)));
  if (entranceCandidates.length) entranceDir = pick(entranceCandidates);
  const protectedSet = new Set();
  if (entranceDir) protectedSet.add(cellKey(layout.start.x, layout.start.z) + '#' + entranceDir.dx + ',' + entranceDir.dz);

  for (const ck of layout.cells) {
    const [gx, gz] = ck.split(',').map(Number);
    const role = roles.get(ck) || 'room';
    const cellLX = gx * BUILDING_CELL, cellLZ = gz * BUILDING_CELL;
    const isCourtyard = role === 'courtyard';
    const wallH = role === 'tower' ? BUILDING_WALL_H * 1.55 : isCourtyard ? BUILDING_WALL_H * 0.42 : BUILDING_WALL_H;

    const floorWorld = buildingLocalToWorld(center, rot, cellLX, cellLZ);
    addBuildingDecor(floorWorld.x, floorWorld.z, BUILDING_CELL - 0.08, BUILDING_CELL - 0.08, 0.05, 0.01, rot, style.floor, { roughness: 0.95 });

    const skipRoof = isCourtyard || (style.ruinChance > 0 && Math.random() < style.ruinChance * 1.2);
    if (!skipRoof) {
      if (role === 'tower' || style.roofShape === 'pitched') {
        addBuildingPitchedRoof(floorWorld.x, floorWorld.z, BUILDING_CELL + 0.3, wallH, rot, style.roof);
      } else {
        addBuildingDecor(floorWorld.x, floorWorld.z, BUILDING_CELL + 0.2, BUILDING_CELL + 0.2, 0.14, wallH, rot, style.roof, { roughness: 0.88 });
      }
    }
    addBuildingCornerPosts(gx, gz, center, rot, style, wallH + (skipRoof ? 0.1 : 0.22));

    for (const d of BUILDING_DIRS) {
      const nx = gx + d.dx, nz = gz + d.dz;
      const hasNeighbor = layout.cells.has(cellKey(nx, nz));
      const wallHOverride = wallH;
      if (hasNeighbor) {
        const hasDoorConn = layout.doors.has(doorKeyOf({ x: gx, z: gz }, { x: nx, z: nz }));
        if (hasDoorConn) continue;
        if (!(d.dx > 0 || (d.dx === 0 && d.dz > 0))) continue;
        buildBuildingWallSideScaled(gx, gz, d, center, rot, false, style, role !== 'entrance' && role !== 'tower', protectedSet, wallHOverride);
      } else {
        const isEntrance = !!entranceDir && gx === layout.start.x && gz === layout.start.z &&
          d.dx === entranceDir.dx && d.dz === entranceDir.dz;
        buildBuildingWallSideScaled(gx, gz, d, center, rot, isEntrance, style, role !== 'entrance' && role !== 'tower', protectedSet, wallHOverride);
      }
    }

    if (role === 'entrance') {
      const hp = buildingLocalToWorld(center, rot, cellLX + (entranceDir ? entranceDir.dx * (BUILDING_CELL / 2 - 0.5) : 0), cellLZ + (entranceDir ? entranceDir.dz * (BUILDING_CELL / 2 - 0.5) : 0));
      addBuildingDecor(hp.x, hp.z, 0.16, 0.16, 2.1, 0, rot, style.pillar, { roughness: 0.7 });
      addBuildingDecor(hp.x, hp.z, 0.32, 0.32, 0.22, 2.1, rot, style.glow, { roughness: 0.4, emissive: style.glow, emissiveIntensity: 0.9, castShadow: false, blockBullets: false });
    } else {
      addBuildingClutter(gx, gz, center, rot, style);
    }
  }
}

function buildBuildingWallSideScaled(gx, gz, d, center, rot, carveDoor, style, allowRuin, protectedSet, wallH) {
  if (Math.abs(wallH - BUILDING_WALL_H) < 0.01) {
    buildBuildingWallSide(gx, gz, d, center, rot, carveDoor, style, allowRuin, protectedSet);
    return;
  }

  const cellLX = gx * BUILDING_CELL, cellLZ = gz * BUILDING_CELL;
  const boundLX = cellLX + d.dx * (BUILDING_CELL / 2);
  const boundLZ = cellLZ + d.dz * (BUILDING_CELL / 2);
  const runAlongX = d.dz !== 0;
  const sideKey = cellKey(gx, gz) + '#' + d.dx + ',' + d.dz;

  if (!carveDoor) {
    if (allowRuin && style.ruinChance > 0 && !protectedSet.has(sideKey) && Math.random() < style.ruinChance) return;
    const w = runAlongX ? BUILDING_CELL : BUILDING_WALL_T;
    const dd = runAlongX ? BUILDING_WALL_T : BUILDING_CELL;
    const wp = buildingLocalToWorld(center, rot, boundLX, boundLZ);
    const wallColor = pick(style.wall);
    addBuildingWallSegment(wp.x, wp.z, w, dd, wallH, rot, wallColor);
    maybeAddWindowPane(wp.x, wp.z, w, dd, rot, style);
    return;
  }

  const flankLen = (BUILDING_CELL - BUILDING_DOOR_W) / 2;
  const off = BUILDING_DOOR_W / 2 + flankLen / 2;
  const wallColor = pick(style.wall);
  if (runAlongX) {
    const p1 = buildingLocalToWorld(center, rot, boundLX - off, boundLZ);
    const p2 = buildingLocalToWorld(center, rot, boundLX + off, boundLZ);
    addBuildingWallSegment(p1.x, p1.z, flankLen, BUILDING_WALL_T, wallH, rot, wallColor);
    addBuildingWallSegment(p2.x, p2.z, flankLen, BUILDING_WALL_T, wallH, rot, wallColor);
  } else {
    const p1 = buildingLocalToWorld(center, rot, boundLX, boundLZ - off);
    const p2 = buildingLocalToWorld(center, rot, boundLX, boundLZ + off);
    addBuildingWallSegment(p1.x, p1.z, BUILDING_WALL_T, flankLen, wallH, rot, wallColor);
    addBuildingWallSegment(p2.x, p2.z, BUILDING_WALL_T, flankLen, wallH, rot, wallColor);
  }
  const headerH = Math.max(0.2, wallH - BUILDING_DOOR_H);
  const hp = buildingLocalToWorld(center, rot, boundLX, boundLZ);
  const hw = runAlongX ? BUILDING_DOOR_W : BUILDING_WALL_T;
  const hd = runAlongX ? BUILDING_WALL_T : BUILDING_DOOR_W;
  addBuildingDecor(hp.x, hp.z, hw, hd, headerH, BUILDING_DOOR_H, rot, style.trim, { roughness: 0.88 });
}

function clearBuildings() {
  for (const part of state.buildingParts) {
    if (part.mesh) {
      state.scene.remove(part.mesh);
      if (part.mesh.geometry) part.mesh.geometry.dispose();
      if (part.mesh.material) part.mesh.material.dispose();
      const ri = state.rayTargets.indexOf(part.mesh); if (ri >= 0) state.rayTargets.splice(ri, 1);
      const ei = state.environmentMeshes.indexOf(part.mesh); if (ei >= 0) state.environmentMeshes.splice(ei, 1);
    }
    if (part.obstacleRef) {
      const oi = state.environmentObstacles.indexOf(part.obstacleRef); if (oi >= 0) state.environmentObstacles.splice(oi, 1);
    }
    if (part.body && state.world) state.world.removeBody(part.body);
  }
  state.buildingParts = [];
}

function generateBuildings() {
  clearBuildings();
  clearBuildingNpcs();
  if (CONFIG.buildingCount <= 0) { rebuildNpcNavigation(); return; }

  const spawnExclusion = { x: 0, z: 6, r: 20 };
  const placed = [];
  let attempts = 0, built = 0;
  while (built < CONFIG.buildingCount && attempts < 80) {
    attempts++;
    const layout = generateBuildingLayout();
    const radius = estimateBuildingRadius(layout);
    const maxDist = CONFIG.arenaHalf - radius - 6;
    if (maxDist < 24) break;
    const angle = Math.random() * Math.PI * 2;
    const dist = 24 + Math.random() * (maxDist - 24);
    const cx = Math.cos(angle) * dist;
    const cz = Math.sin(angle) * dist;
    if (Math.hypot(cx - spawnExclusion.x, cz - spawnExclusion.z) < spawnExclusion.r + radius) continue;
    let overlaps = false;
    for (const p of placed) {
      if (Math.hypot(cx - p.x, cz - p.z) < radius + p.radius + 6) { overlaps = true; break; }
    }
    if (overlaps) continue;
    const rot = Math.random() * Math.PI * 2;
    const style = BUILDING_STYLES[pick(BUILDING_STYLE_NAMES)];
    buildBuildingFromLayout(layout, { x: cx, z: cz }, rot, style);
    placed.push({ x: cx, z: cz, radius });
    built++;
    spawnBuildingDummies(layout, { x: cx, z: cz }, rot);
  }
  rebuildNpcNavigation();
}

function spawnBuildingDummies(layout, center, rot) {
  if (!CONFIG.buildingDummiesEnabled) return;
  const roomCount = layout.cells.size;
  const dummyCount = Math.max(1, Math.min(CONFIG.buildingDummiesMax, Math.round(roomCount * CONFIG.buildingDummiesPerRoom)));
  const cells = shuffleArr(Array.from(layout.cells)).slice(0, dummyCount);
  for (const ck of cells) {
    const [gx, gz] = ck.split(',').map(Number);
    const jitterR = BUILDING_CELL * 0.22 * Math.random();
    const jitterA = Math.random() * Math.PI * 2;
    const lx = gx * BUILDING_CELL + Math.cos(jitterA) * jitterR;
    const lz = gz * BUILDING_CELL + Math.sin(jitterA) * jitterR;
    const worldPos = buildingLocalToWorld(center, rot, lx, lz);
    const npc = spawnNPC(worldPos.x, worldPos.z, Math.random() * Math.PI * 2, true);
    chooseNpcWanderTarget(npc, false);
  }
}

function rebuildNpcNavigation() {
  const step = 3.2;
  state.npcNav.nodes = [];
  state.npcNav.adj = [];
  state.npcNav.coverPoints = [];
  const min = -CONFIG.arenaHalf + 2.0, max = CONFIG.arenaHalf - 2.0;
  const cols = Math.floor((max - min) / step) + 1;
  const idxAt = (ix, iz) => iz * cols + ix;
  for (let iz = 0; iz < cols; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      const x = min + ix * step, z = min + iz * step;
      let blocked = false;
      for (const o of state.environmentObstacles) {
        const pad = CONFIG.npcRadius + 0.35, c = Math.cos(o.rotation || 0), si = Math.sin(o.rotation || 0);
        const dx = x - o.x, dz = z - o.z, lx = dx * c - dz * si, lz = dx * si + dz * c;
        if (Math.abs(lx) < o.w / 2 + pad && Math.abs(lz) < o.d / 2 + pad) { blocked = true; break; }
      }
      state.npcNav.nodes.push(blocked ? null : new THREE.Vector3(x, 0, z));
      state.npcNav.adj.push([]);
    }
  }
  for (let iz = 0; iz < cols; iz++) for (let ix = 0; ix < cols; ix++) {
    const i = idxAt(ix, iz); if (!state.npcNav.nodes[i]) continue;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = ix + dx, nz = iz + dz; if (nx < 0 || nz < 0 || nx >= cols || nz >= cols) continue;
      const ni = idxAt(nx, nz); if (!state.npcNav.nodes[ni]) continue;
      if (dx && dz && (!state.npcNav.nodes[idxAt(ix, nz)] || !state.npcNav.nodes[idxAt(nx, iz)])) continue;
      state.npcNav.adj[i].push(ni);
    }
  }
}

function buildSky() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#89b3d9');
  grad.addColorStop(0.35, '#c9c19a');
  grad.addColorStop(0.62, '#e4cd9c');
  grad.addColorStop(1, '#eeddb4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const hazeGrad = ctx.createLinearGradient(0, canvas.height * 0.42, 0, canvas.height * 0.72);
  hazeGrad.addColorStop(0, 'rgba(214,190,145,0)');
  hazeGrad.addColorStop(1, 'rgba(214,190,145,0.55)');
  ctx.fillStyle = hazeGrad;
  ctx.fillRect(0, canvas.height * 0.4, canvas.width, canvas.height * 0.35);

  ctx.fillStyle = 'rgba(150,128,98,0.35)';
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.56);
  for (let x = 0; x <= canvas.width; x += 32) {
    ctx.lineTo(x, canvas.height * 0.56 - Math.sin(x * 0.006) * 10 - Math.sin(x * 0.021) * 6 - 4);
  }
  ctx.lineTo(canvas.width, canvas.height * 0.6);
  ctx.lineTo(0, canvas.height * 0.6);
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(190, 40, 24),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false })
  );
  state.scene.add(sky);

  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(3.6, 28, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff0c0 })
  );
  sunDisc.position.copy(state.sunLight.position).setLength(150);
  sunDisc.renderOrder = 2;
  state.scene.add(sunDisc);
}

function buildEnvironment() {
  state.ambientLight = new THREE.HemisphereLight(0xd8c6a2, 0x3f3325, 0.62);
  state.scene.add(state.ambientLight);

  state.sunLight = new THREE.DirectionalLight(0xfff3d2, 3.8);
  state.sunLight.position.set(52, 58, 34);
  state.sunLight.target.position.set(state.player.position.x, 0, state.player.position.z);
  state.sunLight.castShadow = true;
  state.sunLight.shadow.mapSize.set(Math.min(6144, state.renderer.capabilities.maxTextureSize || 4096), Math.min(6144, state.renderer.capabilities.maxTextureSize || 4096));
  const shadowCam = state.sunLight.shadow.camera;
  shadowCam.left = -22;
  shadowCam.right = 22;
  shadowCam.top = 22;
  shadowCam.bottom = -22;
  shadowCam.near = 2;
  shadowCam.far = 120;
  state.sunLight.shadow.bias = -0.0000;
  state.sunLight.shadow.normalBias = 0.018;
  state.sunLight.shadow.radius = 0.8;
  state.scene.add(state.sunLight);
  state.scene.add(state.sunLight.target);
  buildSky();

  const groundGeo = new THREE.PlaneGeometry(CONFIG.arenaHalf * 2, CONFIG.arenaHalf * 2, 96, 96);
  const desertTex = makeDesertTexture(2048);
  const desertBump = makeDesertBumpTexture(2048);
  const groundMat = new THREE.MeshStandardMaterial({
    map: desertTex,
    bumpMap: desertBump,
    bumpScale: 0.078,
    roughnessMap: desertBump,
    roughness: 0.96,
    metalness: 0.0,
    color: 0xffffff
  });
  state.groundMesh = new THREE.Mesh(groundGeo, groundMat);
  state.groundMesh.rotation.x = -Math.PI / 2;
  state.groundMesh.receiveShadow = true;
  state.scene.add(state.groundMesh);
  state.rayTargets.push(state.groundMesh);

  scatterDesertRubble();

  generateBuildings();
}

function makeDesertTexture(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#c5a16a';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 130; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 35 + Math.random() * 150;
    const dark = Math.random() < 0.52;
    const alpha = 0.045 + Math.random() * 0.12;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, dark
      ? `rgba(134,98,55,${alpha})`
      : `rgba(232,204,156,${alpha})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 24000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const dark = Math.random() < 0.55;
    const a = dark ? 0.035 + Math.random() * 0.10 : 0.03 + Math.random() * 0.095;
    ctx.fillStyle = dark
      ? `rgba(82,61,39,${a})`
      : `rgba(244,223,183,${a})`;
    const r = 0.25 + Math.random() * 1.35;
    ctx.fillRect(x, y, r, r);
  }

  ctx.lineWidth = 1;
  for (let i = 0; i < 65; i++) {
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.strokeStyle = `rgba(86,61,35,${0.12 + Math.random() * 0.16})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 3 + Math.floor(Math.random() * 5);
    for (let s = 0; s < segs; s++) {
      x += (Math.random() - 0.5) * 48;
      y += (Math.random() - 0.5) * 48;
    }
    ctx.stroke();
  }

  for (let i = 0; i < 12; i++) {
    const y = Math.random() * size;
    ctx.strokeStyle = 'rgba(72,53,33,0.08)';
    ctx.lineWidth = 3 + Math.random() * 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      size * 0.25, y + (Math.random() - 0.5) * 90,
      size * 0.70, y + (Math.random() - 0.5) * 90,
      size, y + (Math.random() - 0.5) * 60
    );
    ctx.stroke();
  }

  for (let i = 0; i < 520; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.55 + Math.random() * 2.4;
    ctx.fillStyle = Math.random() < 0.58
      ? 'rgba(73,58,43,0.42)'
      : 'rgba(175,150,113,0.42)';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.58 + Math.random() * 0.35), Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(35,26,18,0.12)';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.32, y + r * 0.34, r * 0.72, r * 0.38, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineCap = 'round';
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 18 + Math.random() * 70;
    ctx.strokeStyle = `rgba(246,224,178,${0.025 + Math.random() * 0.045})`;
    ctx.lineWidth = 1 + Math.random() * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len * 0.5, y - 3 - Math.random() * 8, x + len, y + (Math.random() - 0.5) * 7);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, state.renderer.capabilities.getMaxAnisotropy());
  tex.wrapS = THREE.MirroredRepeatWrapping;
  tex.wrapT = THREE.MirroredRepeatWrapping;
  tex.repeat.set(5, 5);
  tex.needsUpdate = true;
  return tex;
}

function makeDesertBumpTexture(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d6d6d6';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 8;
    const v = 180 + Math.floor(Math.random() * 65);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgb(${v},${v},${v})`);
    grad.addColorStop(1, 'rgba(214,214,214,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 18000; i++) {
    const v = 190 + Math.floor(Math.random() * 55);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    const s = 0.35 + Math.random() * 1.25;
    ctx.fillRect(Math.random() * size, Math.random() * size, s, s);
  }
  for (let i = 0; i < 90; i++) {
    let x = Math.random() * size, y = Math.random() * size;
    ctx.strokeStyle = `rgba(145,145,145,${0.13 + Math.random() * 0.12})`;
    ctx.lineWidth = 0.8 + Math.random() * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 4 + Math.floor(Math.random() * 5); s++) {
      x += (Math.random() - 0.5) * 42;
      y += (Math.random() - 0.5) * 42;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = Math.min(8, state.renderer.capabilities.getMaxAnisotropy());
  tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
  tex.repeat.set(5, 5);
  tex.needsUpdate = true;
  return tex;
}

function scatterDesertRubble() {
  const half = CONFIG.arenaHalf - 1.5;
  const isBlocked = (x, z) => {
    for (const o of state.environmentObstacles) {
      const c = Math.cos(o.rotation || 0), s = Math.sin(o.rotation || 0);
      const dx = x - o.x, dz = z - o.z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < o.w / 2 + 0.6 && Math.abs(lz) < o.d / 2 + 0.6) return true;
    }
    return false;
  };

  const rockCount = 520;
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a765a, roughness: 1.0, metalness: 0.0, flatShading: true });
  const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let placed = 0, attempts = 0;
  while (placed < rockCount && attempts < rockCount * 6) {
    attempts++;
    const x = (Math.random() * 2 - 1) * half;
    const z = (Math.random() * 2 - 1) * half;
    if (isBlocked(x, z)) continue;
    const s = 0.045 + Math.random() * 0.16;
    dummy.position.set(x, s * (0.35 + Math.random() * 0.25), z);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    dummy.scale.set(s * (0.7 + Math.random() * 0.6), s * (0.5 + Math.random() * 0.5), s * (0.7 + Math.random() * 0.6));
    dummy.updateMatrix();
    rockMesh.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  rockMesh.count = placed;
  rockMesh.instanceMatrix.needsUpdate = true;
  state.scene.add(rockMesh);

  const stickCount = 180;
  const stickGeo = new THREE.CylinderGeometry(1, 1, 1, 5);
  const stickMat = new THREE.MeshStandardMaterial({ color: 0x5a4326, roughness: 1.0, metalness: 0.0 });
  const stickMesh = new THREE.InstancedMesh(stickGeo, stickMat, stickCount);
  stickMesh.castShadow = true;
  stickMesh.receiveShadow = true;
  placed = 0; attempts = 0;
  while (placed < stickCount && attempts < stickCount * 6) {
    attempts++;
    const x = (Math.random() * 2 - 1) * half;
    const z = (Math.random() * 2 - 1) * half;
    if (isBlocked(x, z)) continue;
    const len = 0.25 + Math.random() * 0.55;
    const rad = 0.012 + Math.random() * 0.02;
    dummy.position.set(x, rad * 0.9, z);
    dummy.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.3, 0, Math.random() * Math.PI);
    dummy.scale.set(rad, len, rad);
    dummy.updateMatrix();
    stickMesh.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  stickMesh.count = placed;
  stickMesh.instanceMatrix.needsUpdate = true;
  state.scene.add(stickMesh);

  const chunkGeo = new THREE.DodecahedronGeometry(1, 0);
  const chunkMat = new THREE.MeshStandardMaterial({ color: 0x8f8a7e, roughness: 0.97, metalness: 0.0, flatShading: true });
  for (let i = 0; i < 32; i++) {
    const x = (Math.random() * 2 - 1) * half;
    const z = (Math.random() * 2 - 1) * half;
    if (isBlocked(x, z)) continue;
    const s = 0.2 + Math.random() * 0.35;
    const chunk = new THREE.Mesh(chunkGeo, chunkMat);
    chunk.position.set(x, s * 0.3, z);
    chunk.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    chunk.scale.set(s, s * (0.5 + Math.random() * 0.4), s);
    chunk.castShadow = true;
    chunk.receiveShadow = true;
    state.scene.add(chunk);
  }

  const fragmentCount = 150;
  const fragmentGeo = new THREE.BoxGeometry(1, 1, 1);
  const fragmentMat = new THREE.MeshStandardMaterial({ color: 0x77736a, roughness: 0.94, metalness: 0.02 });
  const fragments = new THREE.InstancedMesh(fragmentGeo, fragmentMat, fragmentCount);
  fragments.castShadow = true;
  fragments.receiveShadow = true;
  placed = 0; attempts = 0;
  while (placed < fragmentCount && attempts < fragmentCount * 7) {
    attempts++;
    const x = (Math.random() * 2 - 1) * half;
    const z = (Math.random() * 2 - 1) * half;
    if (isBlocked(x, z)) continue;
    const w = 0.055 + Math.random() * 0.22;
    const h = 0.018 + Math.random() * 0.065;
    const d = 0.045 + Math.random() * 0.18;
    dummy.position.set(x, h * 0.5, z);
    dummy.rotation.set((Math.random() - 0.5) * 0.35, Math.random() * Math.PI, (Math.random() - 0.5) * 0.35);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    fragments.setMatrixAt(placed++, dummy.matrix);
  }
  fragments.count = placed;
  fragments.instanceMatrix.needsUpdate = true;
  state.scene.add(fragments);

  const shardCount = 70;
  const shardGeo = new THREE.BoxGeometry(1, 1, 1);
  const shardMat = new THREE.MeshStandardMaterial({ color: 0x594b3b, roughness: 0.78, metalness: 0.45 });
  const shards = new THREE.InstancedMesh(shardGeo, shardMat, shardCount);
  shards.castShadow = true;
  placed = 0; attempts = 0;
  while (placed < shardCount && attempts < shardCount * 7) {
    attempts++;
    const x = (Math.random() * 2 - 1) * half;
    const z = (Math.random() * 2 - 1) * half;
    if (isBlocked(x, z)) continue;
    const len = 0.12 + Math.random() * 0.34;
    dummy.position.set(x, 0.012, z);
    dummy.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * 0.16);
    dummy.scale.set(0.012 + Math.random() * 0.018, 0.012, len);
    dummy.updateMatrix();
    shards.setMatrixAt(placed++, dummy.matrix);
  }
  shards.count = placed;
  shards.instanceMatrix.needsUpdate = true;
  state.scene.add(shards);
}

function updateShadowFocus() {
  if (!state.sunLight || !state.renderer.shadowMap.enabled) return;
  const p = state.player.position;
  const target = state.sunLight.target.position;
  const blend = 0.18;
  target.x += (p.x - target.x) * blend;
  target.y = 0;
  target.z += (p.z - target.z) * blend;
  state.sunLight.position.x = target.x + 52;
  state.sunLight.position.y = 58;
  state.sunLight.position.z = target.z + 34;
  state.sunLight.shadow.camera.updateProjectionMatrix();
}

function makeGridTexture(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#777a7c';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#65686a';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);
  ctx.strokeStyle = '#8a8d8f';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(size/2, 0); ctx.lineTo(size/2, size);
  ctx.moveTo(0, size/2); ctx.lineTo(size, size/2);
  ctx.stroke();
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const a = Math.random() * 0.08 + 0.03;
    ctx.fillStyle = `rgba(35,38,40,${a})`;
    const r = Math.random() * 1.2 + 0.25;
    ctx.fillRect(x, y, r, r);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(CONFIG.arenaHalf / 2, CONFIG.arenaHalf / 2);
  return tex;
}

export {
  buildSky,
  buildEnvironment,
  makeDesertTexture,
  makeDesertBumpTexture,
  scatterDesertRubble,
  updateShadowFocus,
  makeGridTexture,
  generateBuildingLayout,
  assignBuildingRoles,
  estimateBuildingRadius,
  buildingLocalToWorld,
  addBuildingWallSegment,
  addBuildingDecor,
  addBuildingPitchedRoof,
  maybeAddWindowPane,
  buildBuildingWallSide,
  addBuildingCornerPosts,
  addBuildingClutter,
  buildBuildingFromLayout,
  buildBuildingWallSideScaled,
  clearBuildings,
  generateBuildings,
  spawnBuildingDummies,
  rebuildNpcNavigation
};