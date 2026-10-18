/** Geometry of the aya braid: two strands r = R ± A·sin(k·t), alternating over and under. */
export interface BraidPoint { x: number; y: number; t: number }

export function braidStrands(opts: { cx: number; cy: number; radius: number; amplitude: number; waves: number; steps?: number }) {
  const { cx, cy, radius, amplitude, waves } = opts;
  const steps = opts.steps ?? 720;
  return [1, -1].map((sign) => {
    const pts: BraidPoint[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = (2 * Math.PI * i) / steps;
      const r = radius + sign * amplitude * Math.sin(waves * t);
      // Start at 12 o'clock and run clockwise.
      pts.push({ x: cx + r * Math.sin(t), y: cy - r * Math.cos(t), t });
    }
    return pts;
  });
}

/** True when strand `s` passes under the other one near parameter t. */
export function isUnder(s: number, t: number, waves: number, gapRad: number): boolean {
  for (let j = 0; j < 2 * waves; j++) {
    if (j % 2 !== (s === 0 ? 1 : 0)) continue;
    const u = (Math.PI * j) / waves;
    const d = Math.min(Math.abs(t - u), 2 * Math.PI - Math.abs(t - u));
    if (d < gapRad) return true;
  }
  return false;
}

export const toPath = (pts: BraidPoint[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
