import { de } from '../../i18n/de.ts';
import './TabBar.css';

export type TabId = 'today' | 'calendar' | 'insights' | 'settings';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'today', label: de.tabs.today, icon: 'M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm0 5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z' },
  { id: 'calendar', label: de.tabs.calendar, icon: 'M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4' },
  // Muster: two strands woven over and under each other (綾).
  { id: 'insights', label: de.tabs.insights, icon: 'M3 9c3 0 4.5 6 9 6s6-6 9-6M3 15c3 0 4.5-6 9-6s6 6 9 6' },
  { id: 'settings', label: de.tabs.settings, icon: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4' },
];

interface Props {
  active: TabId;
  onSelect: (id: TabId) => void;
}

export function TabBar({ active, onSelect }: Props) {
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className="tab"
          aria-current={t.id === active ? 'page' : undefined}
          onClick={() => onSelect(t.id)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={t.icon} />
          </svg>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
