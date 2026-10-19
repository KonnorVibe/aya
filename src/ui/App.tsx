import { useCallback, useEffect, useState } from 'react';
import { todayLocal } from '../engine/dates.ts';
import { predict } from '../engine/prediction.ts';
import { overridesFrom } from '../engine/types.ts';
import { de } from '../i18n/de.ts';
import { useApp } from '../state/store.ts';
import { DayLogSheet } from './components/DayLogSheet.tsx';
import { TabBar, type TabId } from './components/TabBar.tsx';
import { useAutoLock, usePrivacyShield, useTheme } from './hooks/useAppEnvironment.ts';
import { LockScreen } from './screens/LockScreen.tsx';
import { Onboarding } from './screens/Onboarding.tsx';
import { Calendar } from './screens/Calendar.tsx';
import { Insights } from './screens/Insights.tsx';
import { Learn, Method } from './screens/Article.tsx';
import { Settings, type Panel } from './screens/Settings.tsx';
import { Today } from './screens/Today.tsx';
import './theme/tokens.css';
import './theme/base.css';

export function App({ dbName }: { dbName?: string }) {
  const status = useApp((s) => s.status);
  const settings = useApp((s) => s.settings);
  const logs = useApp((s) => s.logs);
  const pinSet = useApp((s) => s.pinSet);
  const protection = useApp((s) => s.protection);
  const setupProtection = useApp((s) => s.setupProtection);
  const lastBackupAt = useApp((s) => s.lastBackupAt);
  const init = useApp((s) => s.init);
  const completeOnboarding = useApp((s) => s.completeOnboarding);
  const saveDayLog = useApp((s) => s.saveDayLog);
  const startPeriod = useApp((s) => s.startPeriod);
  const endPeriod = useApp((s) => s.endPeriod);
  const togglePeriodDay = useApp((s) => s.togglePeriodDay);
  const includeCycle = useApp((s) => s.includeCycle);
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const lockNow = useApp((s) => s.lock);
  const [tab, setTabState] = useState<TabId>('today');
  const [calendarFocus, setCalendarFocus] = useState<{ start: string; length: number } | undefined>();
  const [settingsPanel, setSettingsPanel] = useState<Panel | undefined>();
  /** Long-form pages over the current tab; the last one is shown, "Zurück" pops it. */
  const [pages, setPages] = useState<('method' | 'learn')[]>([]);
  const openPage = (p: 'method' | 'learn') => {
    setPages((cur) => [...cur, p]);
    window.scrollTo?.(0, 0);
  };
  const back = () => setPages((cur) => cur.slice(0, -1));
  const setTab = (next: TabId) => {
    setCalendarFocus(undefined);
    setSettingsPanel(undefined);
    setPages([]);
    setTabState(next);
  };
  const today = todayLocal();

  useEffect(() => {
    void init(dbName);
  }, [init, dbName]);

  const lock = useCallback(() => lockNow(), [lockNow]);
  useTheme(settings?.theme);
  // Passphrase mode always locks itself; device mode only with a PIN.
  useAutoLock((pinSet || protection === 'passphrase') && status === 'ready', settings?.lockMinutes ?? 5, lock);
  usePrivacyShield(!!settings?.privacyShield);

  if (status === 'loading') return null;
  if (status === 'error') return <p className="load-error">{de.loadError}</p>;
  if (status === 'onboarding') {
    return (
      <Onboarding
        today={today}
        protection={protection}
        onProtect={setupProtection}
        onDone={(input) => void completeOnboarding(input, today)}
      />
    );
  }
  if (status === 'locked') return <LockScreen />;

  const prediction = settings ? predict({ logs, settings, today, overrides: overridesFrom(settings) }) : null;
  const page = pages.at(-1);
  return (
    <>
      {page === 'method' && <Method onBack={back} onLearn={() => openPage('learn')} />}
      {page === 'learn' && <Learn onBack={back} />}
      {!page && tab === 'today' && (
        <Today
          prediction={prediction}
          logs={logs}
          settings={settings!}
          today={today}
          lastBackupAt={lastBackupAt}
          onPeriodStart={() => void startPeriod(today)}
          onPeriodEnd={() => void endPeriod(today)}
          onLog={() => setSheetDate(today)}
          onAddMissed={(start, length) => {
            setCalendarFocus({ start, length });
            setTabState('calendar');
          }}
          onIncludeCycle={(c) => void includeCycle(c)}
          onImport={() => {
            setTab('settings');
            setSettingsPanel('import');
          }}
          onMethod={() => openPage('method')}
        />
      )}
      {!page && tab === 'calendar' && settings && (
        <Calendar
          logs={logs}
          settings={settings}
          prediction={prediction}
          today={today}
          onOpenDay={setSheetDate}
          onTogglePeriod={(d) => void togglePeriodDay(d)}
          onIncludeCycle={(c) => void includeCycle(c)}
          focus={calendarFocus}
        />
      )}
      {!page && tab === 'insights' && settings && (
        <Insights logs={logs} settings={settings} today={today} onMethod={() => openPage('method')} onLearn={() => openPage('learn')} />
      )}
      {!page && tab === 'settings' && (
        <Settings key={settingsPanel ?? ''} prediction={prediction} today={today} initialPanel={settingsPanel} onMethod={() => openPage('method')} />
      )}
      <TabBar active={tab} onSelect={setTab} />
      {sheetDate && (
        <DayLogSheet
          date={sheetDate}
          today={today}
          log={logs.find((l) => l.date === sheetDate)}
          history={logs}
          mode={settings?.mode ?? 'track'}
          onSave={(log) => void saveDayLog(log)}
          onClose={() => setSheetDate(null)}
        />
      )}
    </>
  );
}
