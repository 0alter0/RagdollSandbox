// Global variables
let scene, camera, renderer, clock;
let world;
let groundMesh;
let groundMaterial, ragdollMaterial, shellMaterial;
let groundRagdollContact = null;
let environmentObstacles = [];
let environmentMeshes = [];
let buildingParts = [];
let npcNav = { nodes: [], adj: [], coverPoints: [] };

let hittable = [];
let rayTargets = [];
let bloodParticles = [];
let bloodDecals = [];
let bloodPools = [];
let bloodLandingDots = [];
let damageMarks = [];
let bulletHoles = [];
let goreDebris = [];
let shellCasings = [];

let graphicsQuality = 'high';
let mouseSensitivity = 1.0;
let masterVolume = 0.7;
let bloodEffectsEnabled = true;

let audioCtx = null;
let masterGain = null;
let noiseBuffer = null;