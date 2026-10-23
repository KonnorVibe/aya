import type { ReactNode } from 'react';
import { useState } from 'react';
import { ARTICLES, CATEGORY_LABEL, CYCLE_ARTICLE_ID, type Article, type Category } from '../../content/articles.ts';
import type { ArticleProgress } from '../../engine/types.ts';
import { appStore, useApp } from '../../state/store.ts';
import { de } from '../../i18n/de.ts';
import { Brand } from '../components/Brand.tsx';
import { DoctorHint } from '../components/DoctorHint.tsx';
import './Article.css';

export function ArticlePage({ title, intro, onBack, children }: { title: string; intro: string; onBack: () => void; children: ReactNode }) {
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
            <span className="article-num" aria-hidden="true">{i + 1}</span>
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

      <ArticleCheck article={ARTICLES.find((x) => x.id === CYCLE_ARTICLE_ID)!} />
      <DoctorHint />
      <p className="article-disclaimer">{de.disclaimer}</p>
    </ArticlePage>
  );
}

const k = de.knowledge;

function ArticleCard({ article, unread, onOpen }: { article: Article; unread: boolean; onOpen: (id: string) => void }) {
  return (
    <li>
      <button type="button" className="knowledge-card" onClick={() => onOpen(article.id)}>
        <span className="knowledge-meta">
          {CATEGORY_LABEL[article.category]} · {k.minutes(article.minutes)}
          {unread && (
            <span className="knowledge-unread">
              <i aria-hidden="true" />
              {k.unread}
            </span>
          )}
        </span>
        <span className="knowledge-title">{article.title}</span>
        <span className="knowledge-teaser">{article.teaser}</span>
      </button>
    </li>
  );
}

/** The Wissen tab by category, "Der Zyklus" first. Each article is unread until its question is answered. */
export function Knowledge({ onOpen, onMethod }: { onOpen: (id: string) => void; onMethod: () => void }) {
  const progress = useApp((st) => st.settings?.articles);
  const unread = (a: Article) => !progress?.[a.id]?.answered;
  const categories = (Object.keys(CATEGORY_LABEL) as Category[]).filter((c) => ARTICLES.some((a) => a.category === c));
  return (
    <main className="article knowledge">
      <h1 className="knowledge-heading">{k.title}</h1>
      <p className="article-intro">{k.intro}</p>
      {categories.map((c) => (
        <section key={c} className="article-section" aria-labelledby={`k-${c}`}>
          <h2 id={`k-${c}`}>{CATEGORY_LABEL[c]}</h2>
          <ul className="knowledge-list">
            {ARTICLES
              .filter((a) => a.category === c)
              .map((a) => (
                <ArticleCard key={a.id} article={a} unread={unread(a)} onOpen={onOpen} />
              ))}
          </ul>
        </section>
      ))}
      <button type="button" className="row row-button article-link" onClick={onMethod}>
        <span>{m.title}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
      <p className="article-disclaimer">{k.updates}</p>
    </main>
  );
}

/**
 * The end of every article: one question (answering it right marks the article read) and an
 * optional note on what to keep. Both are saved encrypted with the other data.
 */
export function ArticleCheck({ article }: { article: Article }) {
  const progress = useApp((st) => st.settings?.articles);
  const updateSettings = useApp((st) => st.updateSettings);
  const mine = progress?.[article.id];
  const [picked, setPicked] = useState<number | null>(mine?.answered ? article.quiz.answer : null);
  const [note, setNote] = useState(mine?.note ?? '');
  const q = article.quiz;

  const save = (patch: Partial<ArticleProgress>) => {
    // Read the latest progress: answering and a note can follow each other quickly.
    const all = appStore.getState().settings?.articles;
    const now = all?.[article.id];
    const next: ArticleProgress = { answered: now?.answered ?? false, ...(now?.note ? { note: now.note } : {}), ...patch };
    if (!next.note) delete next.note;
    void updateSettings({ articles: { ...all, [article.id]: next } });
  };
  const pick = (i: number) => {
    setPicked(i);
    if (i === q.answer && !mine?.answered) save({ answered: true });
  };
  const right = picked === q.answer;

  return (
    <section className="article-section article-check" aria-labelledby={`check-${article.id}`}>
      <h2 id={`check-${article.id}`}>{k.checkTitle}</h2>
      <fieldset className="check-options">
        <legend>{q.question}</legend>
        {q.options.map((o, i) => (
          <button
            key={o}
            type="button"
            className={picked === i ? (i === q.answer ? 'check-option is-right' : 'check-option is-wrong') : 'check-option'}
            aria-pressed={picked === i}
            disabled={right}
            onClick={() => pick(i)}
          >
            {o}
          </button>
        ))}
      </fieldset>
      {picked !== null && (
        <p className={right ? 'check-result is-right' : 'check-result'} role="status">
          <strong>{right ? k.right : k.wrong}</strong> {right ? q.explain : k.tryAgain}
        </p>
      )}
      <label className="check-note">
        <span>{k.noteLabel}</span>
        <textarea
          rows={3}
          placeholder={k.notePlaceholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note.trim() !== (mine?.note ?? '') && save({ note: note.trim() })}
        />
      </label>
      <p className="row-hint">{k.noteHint}</p>
    </section>
  );
}

/** One article from the content list. */
export function ArticleView({ article, onBack }: { article: Article; onBack: () => void }) {
  return (
    <ArticlePage title={article.title} intro={article.teaser} onBack={onBack}>
      <div className="article-section">
        {article.blocks.map((b, i) => {
          if (b.type === 'h') return <h2 key={i}>{b.text}</h2>;
          if (b.type === 'list')
            return (
              <ul key={i} className="article-list">
                {b.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          if (b.type === 'tip') return <p key={i} className="article-tip">{b.text}</p>;
          if (b.type === 'links')
            return (
              <ul key={i} className="article-links">
                {b.items.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.label}
                      <span className="visually-hidden"> ({de.doctor.opens})</span>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5" />
                      </svg>
                    </a>
                    <span>{l.note}</span>
                  </li>
                ))}
              </ul>
            );
          return <p key={i}>{b.text}</p>;
        })}
      </div>
      {article.sources && (
        <section className="article-section" aria-labelledby="article-sources">
          <h2 id="article-sources">{m.sourcesTitle}</h2>
          <ol className="article-sources">
            {article.sources.map((s) => (
              <li key={s}>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <ArticleCheck article={article} />
      <DoctorHint />
      <p className="article-disclaimer">{de.disclaimer}</p>
    </ArticlePage>
  );
}
