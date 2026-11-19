// localStorage save, load and settings for COBALTO.
const SAVE = 'cobalto.save.v1', SET = 'cobalto.settings.v1';

export const DEFAULT_SETTINGS = { volume: 0.7, sens: 1, invert: false, hudScale: 1 };

export function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SET) || '{}')) }; } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s) { try { localStorage.setItem(SET, JSON.stringify(s)); } catch {} }
export function hasSave() { try { return !!localStorage.getItem(SAVE); } catch { return false; } }
export function saveGame(data) { try { localStorage.setItem(SAVE, JSON.stringify({ ...data, savedAt: Date.now() })); return true; } catch { return false; } }
export function loadGame() { try { return JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch { return null; } }
export function clearSave() { try { localStorage.removeItem(SAVE); } catch {} }
