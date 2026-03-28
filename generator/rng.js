function mulberry32(seed) {
  let current = seed >>> 0;

  return function next() {
    current = (current + 0x6d2b79f5) >>> 0;
    let t = Math.imul(current ^ (current >>> 15), 1 | current);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

export function createRNG(seed) {
  const random = mulberry32(seed);

  return {
    random() {
      return random();
    },
    int(min, max) {
      return Math.floor(random() * (max - min + 1)) + min;
    },
    float(min, max) {
      return random() * (max - min) + min;
    },
    chance(probability) {
      return random() < probability;
    },
  };
}
