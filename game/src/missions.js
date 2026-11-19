// missions.js — the eight jobs of Rafa Cordero, stage by stage. Each stage is a small object with
// an objective line, an optional setup, a done() test and an optional per-frame update. The HUD
// reads one info() object; main.js starts, updates and paints the marker from the same state.
import { locationAt } from './config.js';

const LA_MAREA = { x: 520, z: 566 };
const TOTAL = 8;

export function createMissions(ctx) {
  const { city, player, vehicles, peds, police, combat, hud, world } = ctx;
  const state = {
    index: -1,
    stage: 0,
    stageIndex: 0,
    timer: 0,
    progress: 0,
    active: null,
    completed: [],
    failed: false,
    finished: false,
    marker: null,
    missionCar: null,
    enemies: [],
    interactTimer: 0,
    lastInfo: null,
  };

  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const at = (p, x, z, r) => Math.hypot(player.pos.x - x, player.pos.z - z) < r;
  const say = (speaker, role, line) => hud.dialog(speaker, role, line);
  const toast = (msg, kind) => hud.toast(msg, kind);
  const setMarker = (x, z) => { state.marker = x == null ? null : { x, z }; };
  const inCar = (type) => Boolean(player.vehicle && (!type || player.vehicle.type === type));
  const car = () => player.vehicle;

  const spawnCar = (type, x, z, heading) => {
    if (state.missionCar && !state.missionCar.dead) vehicles.remove(state.missionCar);
    const v = vehicles.spawn(type, x, z, heading, { color: type === 'viento' ? 0xd8463f : type === 'mula' ? 0xe4dcc8 : 0x9b6a4c });
    state.missionCar = v;
    return v;
  };

  const spawnEnemies = (count, cx, cz, radius, cb) => {
    state.enemies = [];
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      const p = peds.spawnCrew(cx + Math.cos(a) * radius, cz + Math.sin(a) * radius, {
        shootCb: cb || ((o) => combat.npcShot(
          { x: o.pos.x, y: 1.2, z: o.pos.z },
          { x: player.pos.x, y: 1.1, z: player.pos.z },
          0.5, 6,
        )),
      });
      state.enemies.push(p);
    }
    return state.enemies;
  };

  const clearEnemies = () => {
    for (const e of state.enemies) e.group.visible = false;
    state.enemies = [];
  };

  const defs = [
    {
      title: 'WELCOME HOME',
      reward: 180,
      respect: 35,
      stages: [
        {
          text: 'TAKE LUCÍA\'S CANGREJO',
          next: 'DRIVE TO LA MAREA',
          enter() {
            spawnCar('cangrejo', -177.5, 606, Math.PI * 0.5);
            setMarker(-177.5, 606);
            say('Lucía', 'La Marea · your sister', 'Rafa. Five years and you still can\'t dress. The Cangrejo is by the bus stop — get here.');
          },
          done() { return inCar('cangrejo'); },
        },
        {
          text: 'DRIVE TO LA MAREA',
          next: 'TALK TO LUCÍA',
          enter() { setMarker(LA_MAREA.x, LA_MAREA.z); },
          done() { return inCar('cangrejo') && at(player, LA_MAREA.x, LA_MAREA.z, 14); },
        },
      ],
      complete() {
        say('Lucía', 'La Marea · your sister', 'Look at you. One drive and the whole bay remembers your face. We need to talk about Rueda.');
        toast('MISSION PASSED', 'money');
      },
    },
    {
      title: 'THE DEBT',
      reward: 260,
      respect: 45,
      stages: [
        {
          text: 'MEET THE COURIER AT EL ASTILLERO',
          next: 'COLLECT THE ENVELOPE',
          enter() { setMarker(-650, 520); say('Lucía', 'La Marea · your sister', 'Rueda\'s courier is at the old dock. Take the envelope, and do not let the PDC see you carry it.'); },
          done() { return at(player, -650, 520, 14); },
        },
        {
          text: 'COLLECT THE ENVELOPE',
          next: 'LOSE THE TAIL',
          timer: 3.2,
          enter() { police.commit(1, 'meeting at the docks'); },
          done() { return state.timer <= 0; },
        },
        {
          text: 'LOSE THE TAIL',
          next: 'RETURN TO LA MAREA',
          enter() {
            police.setLevel(2);
            setMarker(null);
            say('PDC DISPATCH', 'radio', 'Grey Cangrejo leaving the docks. Suspect is armed and carrying. All units, follow.');
          },
          done() { return police.state.level === 0; },
        },
        {
          text: 'RETURN TO LA MAREA',
          next: 'HAND LUCÍA THE ENVELOPE',
          enter() { setMarker(LA_MAREA.x, LA_MAREA.z); },
          done() { return at(player, LA_MAREA.x, LA_MAREA.z, 14) && !player.vehicle; },
        },
      ],
      complete() {
        say('Lucía', 'La Marea · your sister', 'Rueda counts everything. If this is short, he takes it out of the bar. Go see him before he counts it twice.');
        toast('MISSION PASSED', 'money');
      },
    },
    {
      title: 'BAD CARGO',
      reward: 340,
      respect: 55,
      stages: [
        {
          text: 'STEAL THE MULA FROM THE DOCKS',
          next: 'DELIVER IT TO MERCADO VIEJO',
          enter() {
            spawnCar('mula', -610, 548, 0);
            setMarker(-610, 548);
            say('Lucía', 'La Marea · your sister', 'A Mula van is sitting at the dock with Rueda\'s laundry in the back. Take it to the market. Keep it in one piece.');
          },
          done() { return inCar('mula'); },
        },
        {
          text: 'DELIVER THE MULA TO MERCADO VIEJO',
          next: 'KEEP IT ABOVE 40% CONDITION',
          enter() { setMarker(-420, 120); },
          done() {
            const v = car();
            return Boolean(v) && v.type === 'mula' && at(player, -420, 120, 14) && (v.health / v.maxHealth) > 0.4;
          },
        },
      ],
      complete() {
        say('Mercado', 'Market runner', 'Tell Lucía the crates are clean. The old woman at the stall says the van smells like the sea. That is not a compliment.');
        toast('MISSION PASSED', 'money');
      },
    },
    {
      title: 'THE CAPTAIN',
      reward: 300,
      respect: 50,
      stages: [
        {
          text: 'TAIL CAPITÁN SALAS',
          next: 'STAY 12–55 M BEHIND HER',
          enter() {
            if (state.missionCar && !state.missionCar.dead) vehicles.remove(state.missionCar);
            const v = vehicles.spawn('cangrejo', 760, 600, -Math.PI / 2, { police: true, color: 0xe9e5d9 });
            v.siren = false;
            v.ai = { throttle: 0.65, steer: 0 };
            state.missionCar = v;
            state.progress = 0;
            setMarker(null);
            say('Lucía', 'La Marea · your sister', 'Salas drives the coast road every evening. Follow her. Do not get close enough to read her badge — she knows your face.');
          },
          update(dt) {
            const v = state.missionCar;
            if (!v || v.dead) return;
            const d = Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z);
            if (d > 12 && d < 55) state.progress += dt;
            else if (d < 10) {
              state.progress = 0;
              if (Math.random() < dt * 0.5) say('Capitán Salas', 'PDC · patrol', 'I can smell that car from here, Cordero. Back off.');
            } else state.progress = Math.max(0, state.progress - dt * 0.5);
          },
          done() { return state.progress >= 12; },
        },
        {
          text: 'GET BACK TO LA MAREA',
          next: 'SALAS WILL REMEMBER THIS',
          enter() { setMarker(LA_MAREA.x, LA_MAREA.z); },
          done() { return at(player, LA_MAREA.x, LA_MAREA.z, 15); },
        },
      ],
      complete() {
        say('Capitán Salas', 'PDC · radio', 'You are not the only one who knows the coast road, Cordero. Next time I will not just drive past.');
        toast('MISSION PASSED', 'money');
      },
    },
    {
      title: 'CERRO ALTO',
      reward: 420,
      respect: 70,
      stages: [
        {
          text: 'GET UP TO VILLA RUEDA',
          next: 'STEAL THE TIBURÓN',
          enter() { setMarker(-420, -560); say('Lucía', 'La Marea · your sister', 'Rueda keeps a Tiburón at the villa on Cerro Alto. The alarm is old. The guards are not.'); },
          done() { return at(player, -420, -560, 16); },
        },
        {
          text: 'STEAL THE TIBURÓN',
          next: 'ESCAPE THE 3-STAR RESPONSE',
          enter() {
            spawnCar('tiburon', -400, -548, Math.PI);
            setMarker(-400, -548);
            police.setLevel(3);
            police.spawnRoadblock(player.pos.x, player.pos.z, player.heading, 90);
            say('PDC DISPATCH', 'radio', 'Villa alarm, Cerro Alto. Suspect in a blue Tiburón. Roadblock on the switchback.');
          },
          done() { return inCar('tiburon'); },
        },
        {
          text: 'ESCAPE TO THE GARAGE',
          next: 'SHAKE THE PDC',
          enter() { setMarker(-120, 240); },
          done() { return at(player, -120, 240, 16) && police.state.level <= 1; },
        },
      ],
      complete() {
        police.clear();
        say('Taller', 'Garage hand', 'Blue Tiburón, three stars and a dent the shape of a roadblock. You are either lucky or the best driver on this coast.');
        toast('MISSION PASSED', 'money');
      },
    },
    {
      title: 'RADIO SILENCE',
      reward: 460,
      respect: 80,
      stages: [
        {
          text: 'REACH THE RADIO MAST',
          next: 'DESTROY THE MAST',
          enter() { setMarker(760, -460); say('Lucía', 'La Marea · your sister', 'Rueda\'s men talk on that mast on the hill. Cut it and they are shouting into a dead wind.'); },
          done() { return at(player, 760, -460, 20); },
        },
        {
          text: 'DESTROY THE RADIO MAST',
          next: 'SURVIVE THE AMBUSH',
          enter() {
            setMarker(760, -460);
            say('Rafa', 'wanted · armed', 'One clean shot at the base. Then we run.');
          },
          done() { return world.mastDown; },
        },
        {
          text: 'SURVIVE THE AMBUSH',
          next: 'MOVE BEFORE THE PDC ARRIVES',
          timer: 20,
          enter() {
            setMarker(null);
            spawnEnemies(4, 760, -450, 18);
            police.commit(2, 'explosion at the mast');
            say('Rueda', 'smuggling ring · radio', 'You think a hill and a radio make you safe? I own the hill, Rafa.');
          },
          done() { return state.timer <= 0; },
        },
      ],
      complete() {
        clearEnemies();
        say('Lucía', 'La Marea · your sister', 'The mast is down. Rueda is blind. Now he will want to look you in the eye — that is when you take the shot.');
        toast('MISSION PASSED', 'money');
      },
    },
    {
      title: 'THE EXCHANGE',
      reward: 520,
      respect: 90,
      stages: [
        {
          text: 'MEET RUEDA AT THE LIGHTHOUSE',
          next: 'WATCH THE WATER',
          enter() { setMarker(1010, 594); say('Lucía', 'La Marea · your sister', 'The lighthouse at golden hour. Bring the envelope and your nerve. Not the gun. Please, Rafa.'); },
          done() { return at(player, 1010, 594, 18); },
        },
        {
          text: 'WATCH THE WATER',
          next: 'CHASE RUEDA',
          timer: 4.5,
          enter() {
            say('Don Ismael Rueda', 'smuggling ring', 'You look like your father. He also thought the bay belonged to him. Take the boat, Rafa. Leave the coast to me.');
            const v = vehicles.spawn('tiburon', 960, 606, -Math.PI / 2, { color: 0x314b6b });
            v.driver = 'ai';
            v.ai = { throttle: 1, steer: 0 };
            state.missionCar = v;
            police.commit(2, 'shots at the lighthouse');
          },
          done() { return state.timer <= 0; },
        },
        {
          text: 'WRECK RUEDA\'S TIBURÓN',
          next: 'END IT ON THE COAST ROAD',
          enter() { setMarker(null); },
          done() { return !state.missionCar || state.missionCar.dead; },
        },
      ],
      complete() {
        police.clear();
        say('Rafa', 'wanted · armed', 'The Tiburón is in the water. Rueda is not. He ran for the warehouse.');
        toast('MISSION PASSED', 'money');
      },
    },
    {
      title: 'HIGH TIDE',
      reward: 900,
      respect: 160,
      stages: [
        {
          text: 'ASSAULT THE MARINA WAREHOUSE',
          next: 'CLEAR RUEDA\'S CREW',
          enter() {
            setMarker(760, 470);
            spawnEnemies(6, 760, 470, 16, (o) => combat.npcShot(
              { x: o.pos.x, y: 1.2, z: o.pos.z },
              { x: player.pos.x, y: 1.1, z: player.pos.z },
              0.55, 7,
            ));
            say('Lucía', 'La Marea · your sister', 'Rueda is in the warehouse with what is left of his crew. Finish it, Rafa. Then come home.');
          },
          done() { return state.enemies.length > 0 && state.enemies.every((e) => !e.alive); },
        },
        {
          text: 'FIND RUEDA',
          next: 'THE BAY IS YOURS',
          timer: 3.5,
          enter() {
            setMarker(null);
            police.clear();
            say('Don Ismael Rueda', 'smuggling ring', 'The bay always sends someone. This time it sent a Cordero.');
          },
          done() { return state.timer <= 0; },
        },
      ],
      complete() {
        state.finished = true;
        clearEnemies();
        ctx.state.finished = true;
        toast('HIGH TIDE', 'money');
      },
    },
  ];

  const enterStage = () => {
    const def = defs[state.index];
    const stage = def.stages[state.stageIndex];
    state.stage = state.stageIndex;
    state.progress = 0;
    state.timer = stage.timer || 0;
    stage.enter?.();
  };

  const start = (index) => {
    if (index < 0 || index >= TOTAL || state.active) return false;
    state.index = index;
    state.stageIndex = 0;
    state.active = defs[index];
    state.failed = false;
    state.completed = state.completed.filter((i) => i !== index);
    state.enemies = [];
    if (state.missionCar && !state.missionCar.dead) { vehicles.remove(state.missionCar); state.missionCar = null; }
    enterStage();
    return true;
  };

  const finish = () => {
    const def = state.active;
    if (!def) return;
    if (!state.completed.includes(state.index)) state.completed.push(state.index);
    ctx.state.cash += def.reward;
    ctx.state.respect += def.respect;
    toast(`+$${def.reward}`, 'money');
    hud.toast(`MISSION PASSED · ${def.title}`, 'money');
    def.complete?.();
    state.active = null;
    state.marker = { x: LA_MAREA.x, z: LA_MAREA.z };
    state.nextReady = state.index + 1;
  };

  const fail = (why = 'MISSION FAILED') => {
    hud.toast(why, 'wanted');
    state.active = null;
    state.marker = { x: LA_MAREA.x, z: LA_MAREA.z };
    state.nextReady = state.index;
    clearEnemies();
    if (state.missionCar && !state.missionCar.dead) { vehicles.remove(state.missionCar); state.missionCar = null; }
    police.clear();
  };

  const update = (dt) => {
    if (!state.active) return;
    const def = state.active;
    const stage = def.stages[state.stageIndex];
    if (!stage) return;
    if (state.timer > 0) {
      state.timer -= dt;
      if (state.timer <= 0) {
        state.stageIndex += 1;
        if (state.stageIndex >= def.stages.length) { finish(); return; }
        enterStage();
        return;
      }
    }
    stage.update?.(dt);
    if (stage.done?.()) {
      state.stageIndex += 1;
      if (state.stageIndex >= def.stages.length) finish();
      else enterStage();
    }
  };

  const info = () => {
    if (!state.active) {
      const next = Math.min(TOTAL - 1, state.nextReady ?? Math.max(0, state.index + 1));
      if (state.finished) return null;
      const def = defs[next];
      return {
        index: next, total: TOTAL, title: def.title,
        objective: 'MEET LUCÍA AT LA MAREA', next: 'PRESS E TO START', stage: 0, stages: def.stages.length, timer: null,
      };
    }
    const def = state.active;
    const stage = def.stages[state.stageIndex];
    return {
      index: state.index, total: TOTAL, title: def.title,
      objective: stage?.text || '', next: stage?.next || '',
      stage: state.stageIndex, stages: def.stages.length,
      timer: state.timer > 0 ? state.timer : null,
    };
  };

  const marker = () => state.marker;

  const canInteract = (pos) => {
    if (state.active) return false;
    if (state.finished) return false;
    const m = state.marker;
    if (!m) return false;
    return Math.hypot(pos.x - m.x, pos.z - m.z) < 6;
  };

  const interact = () => {
    if (state.active || state.finished) return false;
    const m = state.marker;
    if (!m || Math.hypot(player.pos.x - m.x, player.pos.z - m.z) > 6) return false;
    const next = state.nextReady ?? (state.index + 1);
    if (next >= TOTAL) return false;
    return start(next);
  };

  const reset = () => {
    state.active = null;
    state.marker = { x: LA_MAREA.x, z: LA_MAREA.z };
    state.nextReady = Math.max(0, state.index + 1);
    clearEnemies();
    if (state.missionCar && !state.missionCar.dead) vehicles.remove(state.missionCar);
    state.missionCar = null;
  };

  return { state, defs, start, update, info, marker, canInteract, interact, reset, finish, fail, TOTAL };
}
