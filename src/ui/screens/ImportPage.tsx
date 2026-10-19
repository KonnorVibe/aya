import { useState } from 'react';
import { de } from '../../i18n/de.ts';
import { ArticlePage } from './Article.tsx';
import { RestorePanel } from './settings/DataPanels.tsx';
import { ImportPanel } from './settings/ImportPanels.tsx';
import './ImportPage.css';

const t = de.importPage;
type Source = keyof typeof t.sources;
const SOURCES = Object.keys(t.sources) as Source[];
const ACCEPT: Record<Exclude<Source, 'backup'>, string> = {
  health: '.zip,.xml,application/zip,text/xml',
  flo: '.json,.csv,.txt,.zip,application/json,text/csv,application/zip',
  other: '.csv,.json,.txt,text/csv,application/json',
};

/**
 * Import as its own page (from the empty Today screen): pick where the data comes from, read how to
 * get the file out of that app, then choose it. The reading itself is the settings' import panel.
 */
export function ImportPage({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [source, setSource] = useState<Source | null>(null);

  if (!source) {
    return (
      <ArticlePage title={t.title} intro={t.intro} onBack={onBack}>
        <ul className="import-choices">
          {SOURCES.map((s) => (
            <li key={s}>
              <button type="button" className="import-choice" onClick={() => setSource(s)}>
                <span className="import-choice-text">
                  <span className="import-choice-label">{t.sources[s].label}</span>
                  <span className="import-choice-hint">{t.sources[s].hint}</span>
                </span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
        <p className="article-disclaimer">{t.private}</p>
      </ArticlePage>
    );
  }

  const info = t.sources[source];
  return (
    <ArticlePage title={info.label} intro={info.hint} onBack={() => setSource(null)}>
      <section className="article-section" aria-labelledby="import-steps">
        <h2 id="import-steps">{t.how}</h2>
        <ol className="import-steps">
          {info.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <section className="article-section" aria-labelledby="import-file">
        <h2 id="import-file">{t.file}</h2>
        {source === 'backup' ? <RestorePanel /> : <ImportPanel intro="" accept={ACCEPT[source]} onDone={onDone} />}
      </section>
    </ArticlePage>
  );
}
