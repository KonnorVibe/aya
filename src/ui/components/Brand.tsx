import { de } from '../../i18n/de.ts';
import { braidStrands, isUnder, toPath } from '../graphics/braid.ts';
import './Brand.css';

// The aya mark: a braided ring of two strands, ink and indigo, crossing over and under (綾, a woven pattern).
const strands = braidStrands({ cx: 50, cy: 50, radius: 30, amplitude: 6.2, waves: 6, steps: 360 });
const pieces = strands.map((pts, s) => {
  const out: string[] = [];
  let cur: typeof pts = [];
  for (const p of pts) {
    if (isUnder(s, p.t, 6, 0.1)) {
      if (cur.length > 1) out.push(toPath(cur));
      cur = [];
    } else cur.push(p);
  }
  if (cur.length > 1) out.push(toPath(cur));
  return out;
});

export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {pieces[0]!.map((d, i) => <path key={`a${i}`} d={d} fill="none" stroke="var(--ink)" strokeWidth={5} strokeLinecap="round" />)}
      {pieces[1]!.map((d, i) => <path key={`b${i}`} d={d} fill="none" stroke="var(--accent)" strokeWidth={5} strokeLinecap="round" />)}
    </svg>
  );
}

/** Mark plus wordmark, used in the screen headers. */
export function Brand() {
  return (
    <span className="brand">
      <Mark size={24} />
      <span className="wordmark">{de.appName}</span>
    </span>
  );
}
