import { de } from '../../i18n/de.ts';
import { AyaSeal } from '../graphics/AyaSeal.tsx';
import { MarkIcon } from './Brand.tsx';
import './TabBar.css';

export type TabId = 'today' | 'calendar' | 'insights' | 'learn' | 'settings';

// Hand-drawn, slightly uneven lines in the spirit of the ring; Heute is the aya mark itself.
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'today', label: de.tabs.today, icon: '' },
  // A page with two rings and one marked day.
  {
    id: 'calendar',
    label: de.tabs.calendar,
    icon: 'M5.2 7.5c0-1.3.9-2.1 2.2-2.1h9.3c1.3 0 2.1.8 2.1 2.1l.1 10.8c0 1.3-.9 2.1-2.2 2.1H7.4c-1.3 0-2.1-.8-2.1-2.1ZM5.4 10.4c4.4-.3 8.8-.2 13.2.1M9 3.7v3.2M15.1 3.5v3.5M15.4 14.7a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0Z',
  },
  // Muster sits in the middle as the 綾 seal (see AyaSeal), without a written label.
  { id: 'insights', label: de.tabs.insights, icon: '' },
  // An open book with a ribbon.
  {
    id: 'learn',
    label: de.tabs.learn,
    icon: 'M12 7.3C9.8 5.7 7.1 5.2 4.3 5.7l.2 12.1c2.8-.4 5.4.1 7.5 1.6 2.1-1.5 4.8-2 7.6-1.6l-.1-12.1c-2.8-.5-5.4 0-7.5 1.6ZM12 7.5v11.7M15.4 6.2v4.5l1.3-1 1.3 1V5.8',
  },
  // Two sliders with their knobs.
  {
    id: 'settings',
    label: de.tabs.settings,
    icon: 'M4 8.2c3-.2 5.6-.1 7.8.1M15.8 8.2c1.4-.1 2.8-.1 4.2 0M4 15.9c1.4-.1 2.7-.1 4-.1M12 15.8c2.7-.1 5.3 0 8 .2M15.7 8.2a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0ZM11.9 15.8a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0Z',
  },
];

interface Props {
  active: TabId;
  onSelect: (id: TabId) => void;
}

export function TabBar({ active, onSelect }: Props) {
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      {TABS.map((t) =>
        t.id === 'insights' ? (
          <button
            key={t.id}
            type="button"
            className="tab tab-seal"
            aria-label={t.label}
            aria-current={t.id === active ? 'page' : undefined}
            onClick={() => onSelect(t.id)}
          >
            <AyaSeal size={40} />
          </button>
        ) : (
          <button
            key={t.id}
            type="button"
            className="tab"
            aria-current={t.id === active ? 'page' : undefined}
            onClick={() => onSelect(t.id)}
          >
            {t.id === 'today' ? (
              <MarkIcon />
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={t.icon} />
              </svg>
            )}
            <span>{t.label}</span>
          </button>
        ),
      )}
    </nav>
  );
}
