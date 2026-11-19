// Deterministic pseudo-randomness. No system randomness is used by the city builder.

export function mulberry32(seed) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(random, minimum, maximum) {
  return minimum + random() * (maximum - minimum);
}

export function pick(random, values) {
  return values[Math.floor(random() * values.length)];
}

export function chance(random, probability) {
  return random() < probability;
}
