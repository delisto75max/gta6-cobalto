// Lane traffic: civilian cars that cruise, brake for each other and can be carjacked.
import { createVehicle, forward } from './vehicles.js';
import { RNG, clamp } from './rng.js';

const TYPES = ['cangrejo', 'marea', 'mula', 'tiento', 'viento', 'tiburon', 'cangrejo', 'marea'];
const COLORS = [0x8fa08a, 0xd8d2c2, 0x9bb6c2, 0xc0715a, 0x6f7f88, 0xd9b26a, 0xe0ddd0, 0x56707c, 0xb04f43, 0x7c8f6a];

export class Traffic {
  constructor(scene, city, count = 45) {
    this.scene = scene; this.city = city; this.count = count;
    this.rng = new RNG(0x7a1f);
    this.cars = [];
    this.lanes = city.lanes.filter((l) => l.main || this.rng.chance(0.5));
    for (let i = 0; i < count; i++) this.spawnNear(0, 0, 600, true);
  }
  newCar(lane, t) {
    const type = TYPES[this.rng.int(0, TYPES.length - 1)];
    const v = createVehicle(this.scene, type, {
      ai: true, simple: true, x: 0, z: 0, speed: lane.speed,
      color: COLORS[this.rng.int(0, COLORS.length - 1)], lane,
    });
    v.lane = lane; v.t0 = t;
    v.speed = lane.speed * this.rng.range(0.75, 1.15);
    v.targetSpeed = lane.speed;
    v.traffic = true;
    this.placeOnLane(v, t);
    this.cars.push(v);
    return v;
  }
  placeOnLane(v, t) {
    const l = v.lane;
    v.t = t;
    if (l.axis === 'z') {
      v.pos.set(l.at + this.rng.range(-0.35, 0.35), 0, t);
      v.heading = l.dir > 0 ? 0 : Math.PI;
    } else {
      v.pos.set(t, 0, l.at + this.rng.range(-0.35, 0.35));
      v.heading = l.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    v.group.position.set(v.pos.x, 0.02, v.pos.z);
    v.group.rotation.y = v.heading;
  }
  spawnNear(x, z, radius, anywhere = false) {
    const lane = this.lanes[this.rng.int(0, this.lanes.length - 1)];
    const t = anywhere ? this.rng.range(lane.from, lane.to) : clamp((lane.axis === 'z' ? z : x) + this.rng.range(-radius, radius), lane.from, lane.to);
    this.newCar(lane, t);
  }
  update(dt, playerPos, playerCar, audio) {
    const live = this.cars.filter((v) => !v.dead);
    for (const v of live) {
      const l = v.lane;
      if (!l) continue;
      let want = v.targetSpeed;
      // brake for a car ahead in the same lane
      for (const o of live) {
        if (o === v || o.lane !== v.lane) continue;
        const d = (o.t - v.t) * l.dir;
        if (d > 0 && d < 13) { want = Math.min(want, Math.max(0, (d - 4) * 1.4)); }
      }
      if (playerCar && playerCar.lane !== null) {
        const sameAxis = l.axis === 'z' ? Math.abs(playerCar.pos.x - l.at) < 3.5 : Math.abs(playerCar.pos.z - l.at) < 3.5;
        if (sameAxis) {
          const d = l.axis === 'z' ? (playerCar.pos.z - v.pos.z) * l.dir : (playerCar.pos.x - v.pos.x) * l.dir;
          if (d > 0 && d < 16) want = Math.min(want, Math.max(0, (d - 6) * 1.2));
        }
      }
      v.speed += clamp(want - v.speed, -18 * dt, 7 * dt);
      v.t += l.dir * v.speed * dt;
      if (l.axis === 'z') {
        v.pos.z = v.t;
        v.heading = l.dir > 0 ? 0 : Math.PI;
      } else {
        v.pos.x = v.t;
        v.heading = l.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      if (v.t > l.to) { v.t = l.from; this.placeOnLane(v, l.from); }
      if (v.t < l.from) { v.t = l.to; this.placeOnLane(v, l.to); }
      v.group.position.set(v.pos.x, 0.02, v.pos.z);
      v.group.rotation.y = v.heading;
      v.group.rotation.z = Math.sin(v.t * 0.3) * 0.004;
    }
    // keep density around the player: recycle the furthest cars
    for (const v of this.cars) {
      if (!v.lane) continue;
      const d = Math.hypot(v.pos.x - playerPos.x, v.pos.z - playerPos.z);
      if (d > 420) {
        const lane = this.lanes[this.rng.int(0, this.lanes.length - 1)];
        v.lane = lane; v.targetSpeed = lane.speed; v.speed = lane.speed;
        const t = (lane.axis === 'z' ? playerPos.z : playerPos.x) + this.rng.range(-260, 260) * lane.dir;
        v.t = clamp(t, lane.from + 6, lane.to - 6);
        this.placeOnLane(v, v.t);
      }
    }
  }
  add(x, z, heading, type = 'tiburon', color = null) {
    const v = createVehicle(this.scene, type, { ai: true, simple: true, x, z, heading, color: color ?? COLORS[this.rng.int(0, COLORS.length - 1)] });
    v.traffic = true; v.lane = null; v.speed = 0; v.targetSpeed = 0; v.parked = true;
    this.cars.push(v);
    return v;
  }
}
