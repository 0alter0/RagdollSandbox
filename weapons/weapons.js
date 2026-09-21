import { CONFIG } from '../config/config.js';
import { state } from '../state.js';

const WEAPONS = {
  models: {},
  animations: {},
  loading: {
    pistol: null,
    shotgun: null,
    ak: null
  },
  totalToLoad: 3,
  loadedCount: 0,
  allLoaded: false,
  loadPromise: null,
  resolveLoad: null,
  rejectLoad: null
};

// this is defined twice and i should fix it but im too lazy
const WEAPON_STATS = {
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

function loadWeaponModels() {
  if (WEAPONS.loadPromise) {
    return WEAPONS.loadPromise;
  }

  WEAPONS.loadPromise = new Promise((resolve, reject) => {
    WEAPONS.resolveLoad = resolve;
    WEAPONS.rejectLoad = reject;
  });

  if (typeof GLTFLoader === 'undefined') {
    console.error('GLTFLoader is not available. Please include three.js GLTFLoader in your HTML.');
    WEAPONS.rejectLoad(new Error('GLTFLoader not available'));
    return WEAPONS.loadPromise;
  }

  const loader = new GLTFLoader();

  const weaponTypes = ['pistol', 'shotgun', 'ak'];
  weaponTypes.forEach(weaponType => {
    WEAPONS.loading[weaponType] = loader.load(
      `./${weaponType}.glb`,
      (gltf) => {
        WEAPONS.models[weaponType] = gltf.scene;
        if (gltf.animations && gltf.animations.length) {
          WEAPONS.animations[weaponType] = gltf.animations;
          console.log(`Loaded ${weaponType} with ${gltf.animations.length} animations`);
        } else {
          console.log(`Loaded ${weaponType} with no animations`);
        }
        WEAPONS.loadedCount++;
        if (WEAPONS.loadedCount >= WEAPONS.totalToLoad) {
          WEAPONS.allLoaded = true;
          if (WEAPONS.resolveLoad) {
            WEAPONS.resolveLoad();
          }
        }
      },
      (xhr) => {
      },
      (error) => {
        console.error(`Failed to load ${weaponType}.glb:`, error);
        WEAPONS.loadedCount++;
        if (WEAPONS.loadedCount >= WEAPONS.totalToLoad) {
          WEAPONS.allLoaded = true;
          if (WEAPONS.resolveLoad) {
            WEAPONS.resolveLoad();
          }
        }
      }
    );
  });

  return WEAPONS.loadPromise;
}

function getWeaponModel(weaponType) {
  if (!WEAPONS.models[weaponType]) {
    console.warn(`Weapon model for ${weaponType} not loaded yet.`);
    return null;
  }
  return WEAPONS.models[weaponType].clone(true);
}

function getActiveWeapon() {
  const weaponType = (state.player && state.player.weapon) ? state.player.weapon : 'pistol';
  return WEAPON_STATS[weaponType] || WEAPON_STATS.pistol;
}

function buildWeapon() {
  const weaponType = (state.player && state.player.weapon) ? state.player.weapon : 'pistol';
  return getWeaponModel(weaponType);
}

export { WEAPONS, WEAPON_STATS, loadWeaponModels, getWeaponModel, getActiveWeapon, buildWeapon };
