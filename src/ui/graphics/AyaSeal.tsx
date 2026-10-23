/**
 * 綾 (aya, a woven pattern) as it is written, set in Hiragino Mincho, the Japanese system serif on
 * every iPhone and Mac (no glyph outlines are copied into the app). Elsewhere a serif fallback shows.
 */
export function AyaSeal({ size = 32 }: { size?: number }) {
  return (
    <svg className="aya-seal" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <text className="aya-seal-glyph" x="24" y="40.5" textAnchor="middle">
        綾
      </text>
    </svg>
  );
}
