import { de } from '../../i18n/de.ts';
import './DoctorHint.css';

const t = de.doctor;

/**
 * When to see a doctor, with links to find one. The links are plain navigations in a new tab:
 * aya itself still sends nothing (connect-src 'none'), and no referrer is passed on.
 */
export function DoctorHint({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <aside className="doctor-hint" aria-labelledby="doctor-hint-title">
      <Heading id="doctor-hint-title">{t.title}</Heading>
      <p>{t.body}</p>
      <ul>
        {t.links.map((l) => (
          <li key={l.href}>
            <a href={l.href} target="_blank" rel="noopener noreferrer">
              {l.label}
              <span className="visually-hidden"> ({t.opens})</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5" />
              </svg>
            </a>
          </li>
        ))}
      </ul>
      <p className="doctor-hint-urgent">{t.urgent}</p>
    </aside>
  );
}
