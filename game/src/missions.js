// Eight story missions, dialogue beats, races and delivery activities.
import { CFG } from './config.js';

const M = [
  {
    title: 'WELCOME HOME', giver: 'Lucía', intro: [
      ['Lucía', 'La Marea · your sister', 'Rafa. Five years and you still walk like the cops are watching.'],
      ['Rafa', 'Back home', 'They are. Get me off this bus stop before they remember my face.'],
    ],
    stages: [
      { type: 'goto', poi: 'busStation', r: 11, objective: 'GET TO THE TERMINAL NORTE', next: "TAKE LUCÍA'S CANGREJO" },
      { type: 'goto', poi: 'laMarea', r: 12, objective: 'DRIVE TO LA MAREA', next: 'TALK TO LUCÍA', car: 'cangrejo' },
      { type: 'goto', poi: 'laMarea', r: 5, objective: 'MEET LUCÍA AT THE BAR', next: 'THE DEBT', done: true },
    ],
    outro: [['Lucía', 'La Marea · your sister', 'Don Ismael wants his money by Friday. Welcome home, hermano.']],
    cash: 350, respect: 60,
  },
  {
    title: 'THE DEBT', giver: 'Lucía', intro: [
      ['Lucía', 'La Marea · your sister', 'An envelope at Almacén 4. Don Ismael sends a tail with it. Lose them.'],
    ],
    stages: [
      { type: 'goto', poi: 'docks', r: 12, objective: 'COLLECT THE ENVELOPE AT ALMACÉN 4', next: 'LOSE THE TAIL' },
      { type: 'goto', poi: 'docks', r: 4, objective: 'PICK UP THE ENVELOPE', next: 'LOSE THE PDC TAIL', wanted: 2 },
      { type: 'evade', objective: 'LOSE THE TAIL', next: 'RETURN TO LA MAREA', time: 2 },
      { type: 'goto', poi: 'laMarea', r: 10, objective: 'BRING THE ENVELOPE TO LUCÍA', next: 'BAD CARGO', done: true },
    ],
    outro: [['Lucía', 'La Marea · your sister', 'Half is already gone. Rueda calls it interest.']],
    cash: 500, respect: 90,
  },
  {
    title: 'BAD CARGO', giver: 'Lucía', intro: [
      ['Lucía', 'La Marea · your sister', 'A Mula van at the docks. Deliver it to Mercado Viejo without turning it into scrap.'],
    ],
    stages: [
      { type: 'goto', poi: 'docks', r: 14, objective: 'STEAL THE MULA VAN AT THE DOCKS', next: 'DRIVE IT TO MERCADO VIEJO', car: 'mula' },
      { type: 'goto', poi: 'mercado', r: 12, objective: 'DELIVER THE MULA TO MERCADO VIEJO', next: 'THE CAPTAIN', car: 'mula', condition: 40 },
      { type: 'goto', poi: 'mercado', r: 5, objective: 'HAND OFF THE CARGO', next: 'THE CAPTAIN', done: true },
    ],
    outro: [['Rafa', 'Back home', 'Cargo is clean. The van is not.']],
    cash: 700, respect: 110,
  },
  {
    title: 'THE CAPTAIN', giver: 'Rafa', intro: [
      ['Rafa', 'Back home', 'Capitana Salas is working the coast road. Follow her cruiser and stay out of the mirror.'],
    ],
    stages: [
      { type: 'goto', poi: 'lighthouse', r: 18, objective: 'PICK UP SALAS ON THE COAST ROAD', next: 'TAIL HER CRUISER', wanted: 0 },
      { type: 'tail', objective: 'TAIL SALAS WITHOUT BEING SEEN', next: 'GET OUT OF THE DISTRICT', time: 18, car: 'police' },
      { type: 'goto', poi: 'laMarea', r: 10, objective: 'REPORT BACK TO LA MAREA', next: 'CERRO ALTO', done: true },
    ],
    outro: [['Capitana Salas', 'PDC · District 4', 'I know that car, Cordero. I will see you soon.']],
    cash: 650, respect: 120,
  },
  {
    title: 'CERRO ALTO', giver: 'Lucía', intro: [
      ['Lucía', 'La Marea · your sister', "Rueda keeps a Tiburón at the villa on Cerro Alto. Take it. Don't get shot."],
    ],
    stages: [
      { type: 'goto', poi: 'villa', r: 14, objective: 'BREAK INTO THE VILLA ON CERRO ALTO', next: 'STEAL THE TIBURÓN' },
      { type: 'goto', poi: 'villa', r: 5, objective: 'TAKE THE TIBURÓN FROM THE DRIVE', next: 'ESCAPE THE HILLS', car: 'tiburon', wanted: 3 },
      { type: 'evade', objective: 'ESCAPE CERRO ALTO WITH 3 STARS', next: 'RADIO SILENCE', time: 4 },
      { type: 'goto', poi: 'laMarea', r: 10, objective: 'BRING THE TIBURÓN TO LA MAREA', next: 'RADIO SILENCE', done: true },
    ],
    outro: [['Rafa', 'Back home', 'Nice car. Bad people.']],
    cash: 900, respect: 150,
  },
  {
    title: 'RADIO SILENCE', giver: 'Lucía', intro: [
      ['Lucía', 'La Marea · your sister', 'The ring talks through the mast above the docks. Cut it and they go deaf.'],
      ['Rafa', 'Back home', 'And then they come looking.'],
    ],
    stages: [
      { type: 'goto', poi: 'mast', r: 16, objective: 'DRIVE TO THE RADIO MAST', next: 'DESTROY THE MAST' },
      { type: 'destroy', poi: 'mast', r: 9, objective: 'DESTROY THE MAST', next: 'SURVIVE THE AMBUSH', time: 2.5 },
      { type: 'survive', objective: 'SURVIVE THE AMBUSH', next: 'THE EXCHANGE', time: 25 },
      { type: 'end', objective: 'GET CLEAR OF THE HILLS', next: 'THE EXCHANGE', done: true },
    ],
    outro: [['Lucía', 'La Marea · your sister', "Kite-1 has the boulevard. Cut the mast and we still have a way out."]],
    cash: 1200, respect: 200,
  },
  {
    title: 'THE EXCHANGE', giver: 'Don Ismael', intro: [
      ['Don Ismael Rueda', 'Smuggling ring', 'The lighthouse, Cordero. Bring the money and we forget the last five years.'],
    ],
    stages: [
      { type: 'goto', poi: 'lighthouse', r: 12, objective: 'MEET RUEDA AT THE LIGHTHOUSE', next: 'CHASE RUEDA' },
      { type: 'chase', objective: 'CHASE RUEDA DOWN THE COAST ROAD', next: 'HIGH TIDE', time: 5, car: 'tiburon' },
      { type: 'goto', poi: 'warehouse', r: 10, objective: 'FOLLOW RUEDA TO THE MARINA WAREHOUSE', next: 'HIGH TIDE', done: true },
    ],
    outro: [['Don Ismael Rueda', 'Smuggling ring', 'You should have stayed in prison, hijo.']],
    cash: 1500, respect: 260,
  },
  {
    title: 'HIGH TIDE', giver: 'Rafa', intro: [
      ['Rafa', 'Back home', "Rueda's crew is in the marina warehouse. Salas is on the take. End it tonight."],
    ],
    stages: [
      { type: 'goto', poi: 'warehouse', r: 14, objective: 'ASSAULT THE MARINA WAREHOUSE', next: 'BEAT RUEDA', wanted: 4 },
      { type: 'kill', objective: 'BEAT RUEDA\'S CREW', next: 'LEAVE THE DOCKS', n: 4 },
      { type: 'goto', poi: 'lighthouse', r: 10, objective: 'LEAVE THE DOCKS', next: 'HIGH TIDE', done: true },
    ],
    outro: [['Lucía', 'La Marea · your sister', 'La Marea is still standing. So are you. That is enough.']],
    cash: 2500, respect: 400,
  },
];

export class Missions {
  constructor(city) {
    this.city = city; this.index = -1; this.stage = 0; this.active = false; this.done = false;
    this.timer = 0; this.progress = 0; this.line = null; this.lineT = 0; this.marker = null;
    this.markerName = ''; this.vehicle = null; this.target = null; this.crew = 0;
    this.activities = [
      { id: 'race-coast', name: 'COAST RUN', poi: 'laMarea', cash: 600, type: 'race' },
      { id: 'race-market', name: 'MARKET LOOP', poi: 'mercado', cash: 500, type: 'race' },
      { id: 'delivery', name: 'DOCKS DELIVERY', poi: 'docks', cash: 400, type: 'delivery' },
    ];
  }
  get mission() { return this.index >= 0 && this.index < M.length ? M[this.index] : null; }
  get stageDef() { const m = this.mission; return m ? m.stages[this.stage] : null; }
  objective() { const s = this.stageDef; return s ? s.objective : this.done ? 'STORY COMPLETE' : 'EXPLORE BAHÍA COBALTO'; }
  nextText() { const s = this.stageDef; return s ? 'NEXT: ' + s.next : ''; }
  say(speaker, role, text, dur = 6) { this.line = { speaker, role, text }; this.lineT = dur; }
  markerPos() {
    if (this.marker) return this.marker;
    const s = this.stageDef;
    if (s && s.poi && this.city.poi[s.poi]) return this.city.poi[s.poi];
    return null;
  }
  start(i, ctx) {
    this.index = i; this.stage = 0; this.active = true; this.done = false; this.timer = 0; this.progress = 0;
    const m = this.mission;
    if (!m) return;
    const l = m.intro[0]; this.say(l[0], l[1], l[2], 7);
    this.setStage(ctx);
    if (ctx.audio) ctx.audio.ui();
  }
  setStage(ctx) {
    const m = this.mission, s = this.stageDef;
    if (!s) return;
    if (s.wanted !== undefined && ctx.police) ctx.police.setWanted(s.wanted);
    if (s.type === 'tail' && ctx.spawnTarget) this.target = ctx.spawnTarget('police');
    if (s.type === 'chase' && ctx.spawnTarget) this.target = ctx.spawnTarget('tiburon');
    if (s.type === 'kill') this.crew = s.n || 4;
    this.timer = s.time || 0; this.progress = 0;
    this.marker = s.poi ? this.city.poi[s.poi] : null;
  }
  advance(ctx) {
    const m = this.mission; if (!m) return;
    this.stage++;
    if (this.stage >= m.stages.length) {
      this.active = false; this.done = true;
      this.say(m.outro[0][0], m.outro[0][1], m.outro[0][2], 8);
      if (ctx.onComplete) ctx.onComplete(m);
      return;
    }
    this.setStage(ctx);
    if (ctx.audio) ctx.audio.ui();
  }
  update(dt, ctx) {
    if (this.lineT > 0) { this.lineT -= dt; if (this.lineT <= 0) this.line = null; }
    if (!this.active) return;
    const s = this.stageDef; if (!s) return;
    const p = ctx.player.inVehicle ? ctx.player.inVehicle.pos : ctx.player.pos;
    const mp = this.markerPos();
    if (s.type === 'goto' && mp) {
      const d = Math.hypot(p.x - mp.x, p.z - mp.z);
      if (d < s.r) {
        if (s.car && (!ctx.player.inVehicle || ctx.player.inVehicle.type !== s.car)) return;
        if (s.condition && ctx.player.inVehicle && ctx.player.inVehicle.health < s.condition) return;
        this.advance(ctx);
      }
    } else if (s.type === 'evade') {
      if (ctx.police.wanted <= (s.wanted ?? 0)) this.progress += dt; else this.progress = 0;
      if (this.progress > (s.time || 2)) this.advance(ctx);
    } else if (s.type === 'tail') {
      if (!this.target) this.target = ctx.spawnTarget ? ctx.spawnTarget('police') : null;
      if (this.target) {
        const d = Math.hypot(p.x - this.target.pos.x, p.z - this.target.pos.z);
        if (d < 42) this.progress += dt; else this.progress = Math.max(0, this.progress - dt * 0.5);
        if (ctx.police.wanted > 0) this.progress = Math.max(0, this.progress - dt * 0.4);
        if (this.progress > (s.time || 18)) this.advance(ctx);
      }
    } else if (s.type === 'destroy') {
      if (mp) {
        const d = Math.hypot(p.x - mp.x, p.z - mp.z);
        if (d < s.r) this.progress += dt; else this.progress = 0;
        if (this.progress > (s.time || 2.5)) { this.advance(ctx); if (ctx.audio) ctx.audio.boom(); }
      }
    } else if (s.type === 'survive') {
      this.timer -= dt;
      if (ctx.police.wanted < 3) ctx.police.setWanted(3);
      if (this.timer <= 0) this.advance(ctx);
    } else if (s.type === 'chase') {
      if (!this.target || this.target.dead) { this.advance(ctx); return; }
      const d = Math.hypot(p.x - this.target.pos.x, p.z - this.target.pos.z);
      if (d < 8 && ctx.player.inVehicle) { this.target.health -= dt * 28; this.progress += dt; }
      if (this.target.health <= 0) this.advance(ctx);
    } else if (s.type === 'kill') {
      if (ctx.police.officers.filter((o) => o.alive).length <= 0 && this.progress > 2) this.advance(ctx);
      else this.progress += dt;
    } else if (s.type === 'end') {
      if (mp) {
        const d = Math.hypot(p.x - mp.x, p.z - mp.z);
        if (d < s.r) this.advance(ctx);
      }
    }
  }
}

export const MISSION_LIST = M;
