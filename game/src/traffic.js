// traffic.js — civilians driving the lane graph. Cars are kinematic while nobody owns them:
// they follow a lane, keep their distance, wrap at the ends, and despawn behind the player.
// The moment the player carjacks one, the vehicle system takes over.
import { VEHICLES } from './config.js';
import { makeRng, range, pick, chance } from './rng.js';

const TYPES = ['cangrejo', 'cangrejo', 'marea', 'marea', 'mula', 'viento', 'tiburon', 'rayo'];

export function createTraffic(scene, city, vehicles, seed = 7719) {
  const rng = makeRng(seed);
  const cars = [];
  let target = 46;

  const laneLength = (lane) => lane.to - lane.from;

  const place = (car) => {
    const lane = car.lane;
    const t = car.t;
    const p = city.lanePoint(lane, t);
    car.v.pos.set(p.x, 0.02, p.z);
    car.v.heading = city.laneHeading(lane);
    car.v.group.position.set(p.x, 0.02, p.z);
    car.v.group.rotation.y = car.v.heading;
  };

  const spawnOnLane = (lane, t, type, opts = {}) => {
    const v = vehicles.spawn(type, 0, 0, city.laneHeading(lane), {
      color: opts.color ?? pick(rng, VEHICLES[type].colors),
      kinematic: true,
      driver: 'ai',
      noRider: false,
    });
    const car = {
      v, lane, t, dir: lane.dir, speed: opts.speed ?? lane.speed * range(rng, 0.78, 1.12),
      baseSpeed: opts.speed ?? lane.speed * range(rng, 0.78, 1.12),
      custom: Boolean(opts.custom), honk: 0,
    };
    v.lane = lane;
    v.laneSpeed = car.speed;
    v.traffic = car;
    place(car);
    cars.push(car);
    return car;
  };

  const laneCandidates = (focus, minDist, maxDist) => {
    const out = [];
    for (const lane of city.lanes) {
      const len = laneLength(lane);
      for (let k = 0; k < 4; k += 1) {
        const t = range(rng, 8, len - 8);
        const p = city.lanePoint(lane, t);
        const d = Math.hypot(p.x - focus.x, p.z - focus.z);
        if (d >= minDist && d <= maxDist) out.push({ lane, t, d });
      }
    }
    return out;
  };

  const spawnAround = (focus, count = 1) => {
    for (let n = 0; n < count; n += 1) {
      const candidates = laneCandidates(focus, 14, 250);
      if (!candidates.length) return;
      const c = pick(rng, candidates);
      let tooClose = false;
      for (const other of cars) {
        if (other.lane === c.lane && Math.abs(other.t - c.t) < 16) { tooClose = true; break; }
      }
      if (tooClose) continue;
      const type = pick(rng, TYPES);
      spawnOnLane(c.lane, c.t, type);
    }
  };

  const removeCar = (car) => {
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
    vehicles.remove(car.v);
  };

  const update = (dt, focus) => {
    // hand the player's carjacked ride over to the vehicle system
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      const c = cars[i];
      if (c.v.dead || c.v.driver === 'player' || c.v.isPlayer) { cars.splice(i, 1); continue; }
      if (c.custom) {
        if (c.speed > 0.1) {
          const fx = Math.sin(c.v.heading), fz = Math.cos(c.v.heading);
          c.v.pos.x += fx * c.speed * dt;
          c.v.pos.z += fz * c.speed * dt;
          c.v.group.position.set(c.v.pos.x, 0.02, c.v.pos.z);
          c.v.group.rotation.y = c.v.heading;
        }
        if (Math.abs(c.v.pos.x) > 1120 || c.v.pos.z > 700 || c.v.pos.z < -800) {
          removeCar(c);
        }
        continue;
      }
      const lane = c.lane;
      const len = laneLength(lane);
      c.t += c.speed * c.dir * dt;
      if (c.t > len - 4) c.t = 4;
      if (c.t < 4) c.t = len - 4;
      // keep a gap to the car in front on this lane
      let gap = 999;
      for (const other of cars) {
        if (other === c || other.lane !== lane) continue;
        const ahead = (other.t - c.t) * c.dir;
        if (ahead > 0 && ahead < gap) gap = ahead;
      }
      const desired = gap < 15 ? Math.max(0, (gap - 8) * 0.9) : c.baseSpeed;
      c.speed += (desired - c.speed) * Math.min(1, dt * 1.8);
      const p = city.lanePoint(lane, c.t);
      c.v.pos.set(p.x, 0.02, p.z);
      c.v.heading = city.laneHeading(lane);
      c.v.group.position.set(p.x, 0.02, p.z);
      c.v.group.rotation.y = c.v.heading;
      const d = Math.hypot(p.x - focus.x, p.z - focus.z);
      if (d > 320) removeCar(c);
    }

    while (cars.length < target) {
      const before = cars.length;
      spawnAround(focus, 2);
      if (cars.length === before) break;
    }
  };

  // A staged car for a screenshot: fixed position, optional constant speed along its heading.
  const stage = (type, x, z, heading, opts = {}) => {
    const v = vehicles.spawn(type, x, z, heading, {
      color: opts.color ?? pick(rng, VEHICLES[type].colors),
      kinematic: true,
      driver: opts.driver ?? 'ai',
      noRider: opts.noRider ?? false,
      police: Boolean(opts.police),
    });
    const car = {
      v, lane: null, t: 0, dir: 1, speed: opts.speed ?? 0, baseSpeed: opts.speed ?? 0,
      custom: true, stage: true, honk: 0,
    };
    v.traffic = car;
    cars.push(car);
    return v;
  };

  const countNear = (pos, radius) => cars.filter((c) => {
    const d = Math.hypot(c.v.pos.x - pos.x, c.v.pos.z - pos.z);
    return d <= radius && !c.v.dead;
  }).length;

  const removeAll = () => { while (cars.length) removeCar(cars[0]); };

  const fill = (focus, n) => {
    let guard = 0;
    while (cars.length < n && guard < 400) { spawnAround(focus, 1); guard += 1; }
  };

  return { cars, update, stage, countNear, removeAll, fill, setTarget: (n) => { target = n; }, get target() { return target; } };
}
