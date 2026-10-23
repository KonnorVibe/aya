import type { Mode, Settings } from '../../engine/types.ts';
import './MiniPreview.css';

/**
 * A thumbnail of the Today screen for the settings tiles: tinted header, ring with the mode's
 * focus arc, two buttons. `theme` forces light or dark; without it the preview follows the app.
 */
export function MiniPreview({ mode, theme }: { mode: Mode; theme?: Exclude<Settings['theme'], 'system'> | undefined }) {
  return (
    <span className="preview" data-preview-mode={mode} data-preview-theme={theme} aria-hidden="true">
      <span className="preview-head" />
      <span className="preview-line" />
      <svg className="preview-ring" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="14" />
        <path d={mode === 'conceive' ? 'M8.9 28.6A14 14 0 0 1 6.1 18' : 'M20 6a14 14 0 0 1 12.1 7'} />
      </svg>
      <span className="preview-buttons">
        <span />
        <span />
      </span>
    </span>
  );
}

/** System: light and dark side by side. */
export function MiniPreviewSystem({ mode }: { mode: Mode }) {
  return (
    <span className="preview-split" aria-hidden="true">
      <MiniPreview mode={mode} theme="light" />
      <MiniPreview mode={mode} theme="dark" />
    </span>
  );
}
