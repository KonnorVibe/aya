import type { ReactNode } from 'react';
import { de } from '../../i18n/de.ts';
import { Brand } from '../components/Brand.tsx';
import { DoctorHint } from '../components/DoctorHint.tsx';
import './Article.css';

function ArticlePage({ title, intro, onBack, children }: { title: string; intro: string; onBack: () => void; children: ReactNode }) {
  return (
    <main className="article">
      <header className="article-head">
        <button type="button" className="article-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          {de.method.back}
        </button>
        <Brand />
      </header>
      <h1>{title}</h1>
      <p className="article-intro">{intro}</p>
      {children}
    </main>
  );
}

const m = de.method;
const l = de.learn;

/** How aya calculates, in full. Opened from the logo on Today, from Muster and from the settings. */
export function Method({ onBack, onLearn }: { onBack: () => void; onLearn: () => void }) {
  return (
    <ArticlePage title={m.title} intro={m.intro} onBack={onBack}>
      {m.sections.map((s, i) => (
        <section key={s.title} className="article-section" aria-labelledby={`method-${i}`}>
          <h2 id={`method-${i}`}>
            <span className="article-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            {s.title}
          </h2>
          {s.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
      <section className="article-section" aria-labelledby="method-sources">
        <h2 id="method-sources">{m.sourcesTitle}</h2>
        <ol className="article-sources">
          {m.sources.map((s) => (
            <li key={s.cite}>
              <span className="article-cite">{s.cite}</span>
              <span>{s.what}</span>
            </li>
          ))}
        </ol>
      </section>
      <p className="article-disclaimer">{m.disclaimer}</p>
      <button type="button" className="row row-button article-link" onClick={onLearn}>
        <span>{m.learn}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </ArticlePage>
  );
}

const PHASE_TONES = ['period', 'follicular', 'fertile', 'luteal'] as const;

/** Educational page about the menstrual cycle. */
export function Learn({ onBack }: { onBack: () => void }) {
  return (
    <ArticlePage title={l.title} intro={l.intro} onBack={onBack}>
      <section className="article-section" aria-labelledby="learn-phases">
        <h2 id="learn-phases">{l.phasesTitle}</h2>
        <ol className="article-phases">
          {l.phases.map((p, i) => (
            <li key={p.name} className={`tone-${PHASE_TONES[i]}`}>
              <h3>{p.name}</h3>
              <p className="article-when">{p.when}</p>
              <p>{p.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="article-section" aria-labelledby="learn-normal">
        <h2 id="learn-normal">{l.normalTitle}</h2>
        <ul className="article-list">
          {l.normal.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <section className="article-section" aria-labelledby="learn-signs">
        <h2 id="learn-signs">{l.signsTitle}</h2>
        <dl className="article-terms">
          {l.signs.map((s) => (
            <div key={s.name}>
              <dt>{s.name}</dt>
              <dd>{s.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="article-section" aria-labelledby="learn-myths">
        <h2 id="learn-myths">{l.mythsTitle}</h2>
        <dl className="article-terms">
          {l.myths.map((x) => (
            <div key={x.myth}>
              <dt>„{x.myth}“</dt>
              <dd>{x.fact}</dd>
            </div>
          ))}
        </dl>
      </section>

      <DoctorHint />
      <p className="article-disclaimer">{de.disclaimer}</p>
    </ArticlePage>
  );
}
