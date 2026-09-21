export const state = {
  scene: null,
  camera: null,
  renderer: null,

  world: null,
  groundMaterial: null,
  ragdollMaterial: null,
  shellMaterial: null,
  groundRagdollContact: null,

  groundMesh: null,

  environmentObstacles: [],
  environmentMeshes: [],
  buildingParts: [],
  npcNav: { nodes: [], adj: [], coverPoints: [] },
  hittable: [],
  rayTargets: [],
  bloodParticles: [],
  bloodDecals: [],
  bloodPools: [],
  bloodLandingDots: [],
  damageMarks: [],
  bulletHoles: [],
  goreDebris: [],
  shellCasings: [],

  sunLight: null,
  ambientLight: null,
  flashLight: null,

  mouseSensitivity: 1.0,
  masterVolume: 0.7,
  bloodEffectsEnabled: true,
  graphicsQuality: 'high',

  audioCtx: null,
  masterGain: null,
  noiseBuffer: null,

  keys: {},
  mouseDX: 0,
  mouseDY: 0,
  pointerLocked: false,
  menuOpen: false,

  player: null,
  npcs: [],

  // Other
  clock: null,
  deltaTime: 0
};