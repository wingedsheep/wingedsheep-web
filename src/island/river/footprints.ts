// Written by tools/models/river.py (just models): don't edit by hand.
// Each rock's outline at the water, an ellipse in the model's own frame (x east, z south) as a
// share of its radius: its middle (x, z), its half-length a and half-breadth b, and the angle
// its long axis lies at (lie, radians from +x towards +z).
export const FOOTPRINTS: Record<string, { x: number; z: number; a: number; b: number; lie: number }> = {
  rock_0: { x: 0.040, z: -0.017, a: 1.043, b: 0.906, lie: -0.128 },
  rock_1: { x: 0.025, z: -0.127, a: 1.007, b: 0.903, lie: -0.313 },
  rock_2: { x: -0.043, z: 0.043, a: 0.946, b: 0.546, lie: -0.033 },
  rock_3: { x: 0.098, z: -0.005, a: 1.078, b: 0.972, lie: 1.346 },
  rock_4: { x: -0.078, z: -0.006, a: 0.974, b: 0.956, lie: 1.373 },
  shard_0: { x: 0.125, z: -0.383, a: 1.793, b: 0.844, lie: -0.043 },
  shard_1: { x: -0.172, z: -0.202, a: 1.522, b: 0.819, lie: -1.501 },
  shard_2: { x: -0.044, z: -0.044, a: 1.797, b: 0.710, lie: 0.067 },
  shard_3: { x: 0.254, z: -0.078, a: 1.143, b: 0.858, lie: 0.371 },
  shard_4: { x: -0.599, z: -0.499, a: 1.293, b: 0.962, lie: 0.206 },
};
