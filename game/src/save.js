// Versioned localStorage persistence. Parsing and applying are separate, so a corrupt payload can
// always be discarded safely without partially changing the live game.
import { PLAYER } from './config.js';

export const SAVE_KEY = 'cobalto.bahia-caliente.save';
export const SAVE_VERSION = 1;
const DEFAULT_RADIO = 'Cobalto 104.7';

function storage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validPayload(data) {
  if (!data || data.v !== SAVE_VERSION) return false;
  if (!finite(data.money) || !finite(data.respect) || !Number.isInteger(data.mission)) return false;
  if (data.mission < 0 || data.mission > 8 || !Array.isArray(data.completed)) return false;
  if (!data.completed.every((id) => typeof id === 'string')) return false;
  if (typeof data.weapon !== 'string' || !finite(data.ammo) || !finite(data.armour)) return false;
  const position = data.player;
  if (!position || !finite(position.x) || !finite(position.y) || !finite(position.z) || !finite(position.heading)) return false;
  if (!data.clock || !finite(data.clock.time) || !finite(data.clock.hour)) return false;
  if (typeof data.radio !== 'string') return false;
  if (data.unlocks && (!Array.isArray(data.unlocks) || !data.unlocks.every((key) => typeof key === 'string'))) return false;
  if (data.inventory && !Array.isArray(data.inventory)) return false;
  return true;
}

function progressFor(ctx) {
  return ctx.progress || {
    money: ctx.player.state.money ?? PLAYER.startingMoney,
    respect: 0, mission: 0, completed: [], weapon: ctx.combat.weaponKey, ammo: ctx.combat.ammo,
    unlocks: [],
  };
}

export function saveGame(ctx) {
  if (!ctx?.player || !ctx?.combat) return null;
  const progress = progressFor(ctx);
  const position = ctx.player.state.position;
  const station = ctx.audio?.stationKey ?? ctx.audio?.station ?? ctx.radio?.station ?? DEFAULT_RADIO;
  const payload = {
    v: SAVE_VERSION,
    money: Math.max(0, Math.round(progress.money)),
    respect: Math.max(0, Math.round(progress.respect)),
    weapon: ctx.combat.weaponKey,
    ammo: ctx.combat.ammo,
    reserve: ctx.combat.reserveAmmo,
    armour: ctx.player.state.armour,
    health: ctx.player.state.health,
    mission: progress.mission,
    completed: [...progress.completed],
    player: { x: position.x, y: position.y, z: position.z, heading: ctx.player.state.heading },
    clock: { time: ctx.clock?.time ?? ctx.time ?? 0, hour: ctx.clock?.hour ?? 17.5 },
    radio: typeof station === 'string' ? station : station?.id ?? DEFAULT_RADIO,
    unlocks: [...(progress.unlocks || [])],
    ledgerChoice: progress.ledgerChoice ?? null,
    inventory: ctx.combat.getInventory(),
  };
  try {
    const store = storage();
    if (!store) return null;
    store.setItem(SAVE_KEY, JSON.stringify(payload));
    return payload;
  } catch {
    return null;
  }
}

export function loadGame() {
  try {
    const store = storage();
    if (!store) return null;
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!validPayload(data)) {
      store.removeItem(SAVE_KEY);
      return null;
    }
    return data;
  } catch {
    try { storage()?.removeItem(SAVE_KEY); } catch {}
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    const store = storage();
    if (!store) return false;
    store.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

function applyPayload(ctx, data) {
  if (!ctx?.player || !ctx?.combat || !validPayload(data)) return false;
  const progress = ctx.progress;
  if (!progress) return false;
  if (ctx.vehicles.activeVehicle) ctx.vehicles.exit();

  progress.money = Math.max(0, Math.round(data.money));
  progress.respect = Math.max(0, Math.round(data.respect));
  progress.mission = data.mission;
  progress.completed = [...data.completed];
  progress.unlocks = [...(data.unlocks || [])];
  progress.ledgerChoice = data.ledgerChoice === 'keep' || data.ledgerChoice === 'burn' ? data.ledgerChoice : null;
  ctx.missions?.reset?.();
  if (progress.unlocks.includes('weapon:smg')) ctx.combat.unlockWeapon?.('viento');
  if (progress.unlocks.includes('weapon:rompe')) ctx.combat.unlockWeapon?.('rompe');
  if (progress.unlocks.includes('weapon:cobre9')) ctx.combat.unlockWeapon?.('cobre9');

  if (Array.isArray(data.inventory)) {
    for (const held of data.inventory) {
      if (!held || typeof held.key !== 'string' || !finite(held.ammo) || !finite(held.reserve)) continue;
      ctx.combat.setAmmo?.(held.key, held.ammo, held.reserve);
    }
  }
  ctx.combat.setWeapon(data.weapon);
  if (ctx.combat.weaponKey !== data.weapon || !Array.isArray(data.inventory)) {
    ctx.combat.setAmmo?.(data.weapon, data.ammo, data.reserve ?? 0);
  }
  const health = finite(data.health) ? data.health : ctx.player.state.maxHealth;
  ctx.combat.restorePlayer(health, data.armour);
  ctx.player.teleport(data.player);
  ctx.player.state.money = progress.money;
  progress.weapon = ctx.combat.weaponKey;
  progress.ammo = ctx.combat.ammo;

  if (ctx.clock) {
    ctx.clock.time = Math.max(0, data.clock.time);
    ctx.clock.hour = ((data.clock.hour % 24) + 24) % 24;
  }
  ctx.time = ctx.clock?.time ?? Math.max(0, data.clock.time);
  if (ctx.audio?.setStation) ctx.audio.setStation(data.radio);
  else if (ctx.audio && 'station' in ctx.audio) {
    try { ctx.audio.station = data.radio; } catch {}
  }
  if (ctx.radio) ctx.radio.station = data.radio;
  return true;
}

export function createSave(ctx) {
  let message = '';
  let messageTime = 0;

  function notify(text, seconds = 2.4) {
    message = text;
    messageTime = seconds;
  }

  function save(context = ctx, options = {}) {
    const payload = saveGame(context);
    if (payload) {
      notify(options.reason === 'safehouse' ? 'SAFEHOUSE · AUTOSAVED' : options.reason === 'autosave' ? 'AUTOSAVED' : 'GAME SAVED');
      if (ctx?.player) ctx.player.state.money = ctx.progress.money;
    } else notify('SAVE UNAVAILABLE', 3.5);
    return payload;
  }

  function load() {
    const payload = loadGame();
    if (!payload || !applyPayload(ctx, payload)) {
      notify('NO VALID SAVE', 3.5);
      return false;
    }
    notify('SAVE LOADED');
    return true;
  }

  function update(dt) {
    messageTime = Math.max(0, messageTime - dt);
    if (messageTime === 0) message = '';
  }

  function drawHUD(g) {
    if (!message) return;
    const ratio = g.canvas.width / Math.max(1, window.innerWidth);
    const width = window.innerWidth;
    g.save();
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.font = '700 11px sans-serif';
    const panelWidth = g.measureText(message).width + 30;
    g.fillStyle = 'rgba(10, 24, 29, 0.82)';
    g.fillRect(width - panelWidth - 22, 108, panelWidth, 32);
    g.fillStyle = '#e6c580';
    g.textAlign = 'center';
    g.fillText(message, width - panelWidth / 2 - 22, 129);
    g.restore();
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat || (event.code !== 'F5' && event.code !== 'F9')) return;
    event.preventDefault();
    if (event.code === 'F5') save(ctx, { reason: 'manual' });
    else load();
  });

  return {
    save, load, saveGame: save, loadGame: load, hasSave, clearSave, update, drawHUD,
    get lastMessage() { return message; },
  };
}
