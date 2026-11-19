// save.js — localStorage save, quick save and the settings that survive a reload.
const SAVE_KEY = 'cobalto.save.v1';
const SETTINGS_KEY = 'cobalto.settings.v1';

export const DEFAULT_SETTINGS = {
  volume: 0.7,
  sensitivity: 1,
  invertY: false,
  hudScale: 1,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}

export function hasSave() {
  try { return Boolean(localStorage.getItem(SAVE_KEY)); } catch { return false; }
}

export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    const p = state.player;
    const data = {
      v: 1,
      cash: state.cash,
      respect: state.respect,
      day: state.day,
      time: state.time,
      pos: { x: p.pos.x, z: p.pos.z },
      heading: p.heading,
      health: p.health,
      armour: p.armour,
      weapon: p.weapon,
      unlocked: p.unlocked.slice(),
      mag: p.mag.slice(),
      reserve: p.reserve.slice(),
      missionIndex: state.missionIndex,
      missionStage: state.missionStage,
      completed: state.completed ? state.completed.slice() : [],
      radioIndex: state.radioIndex,
      wanted: state.policeLevel || 0,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function eraseSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
}
