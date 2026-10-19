import { useCallback, useEffect, useState } from 'react';
import { todayLocal } from '../engine/dates.ts';
import { predict } from '../engine/prediction.ts';
import { overridesFrom } from '../engine/types.ts';
import { de } from '../i18n/de.ts';
import { useApp } from '../state/store.ts';
import { DayLogSheet } from './components/DayLogSheet.tsx';
import { TabBar, type TabId } from './components/TabBar.tsx';
import { isStandalone, useAutoLock, usePrivacyShield, useTheme } from './hooks/useAppEnvironment.ts';
import { useNavigation, type Page } from './hooks/useNavigation.ts';
import { ImportPage } from './screens/ImportPage.tsx';
import { LockScreen } from './screens/LockScreen.tsx';
import { Onboarding } from './screens/Onboarding.tsx';
import { Calendar } from './screens/Calendar.tsx';
import { Insights } from './screens/Insights.tsx';
import { ArticleView, Knowledge, Learn, Method } from './screens/Article.tsx';
import { articleById, CYCLE_ARTICLE_ID } from '../content/articles.ts';
import { Settings } from './screens/Settings.tsx';
import { DeletePanel } from './screens/settings/DataPanels.tsx';
import { Button } from './components/Button.tsx';
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
  const setPeriodDays = useApp((s) => s.setPeriodDays);
  const includeCycle = useApp((s) => s.includeCycle);
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const lockNow = useApp((s) => s.lock);
  const { nav, back, selectTab, openPage, openPageOn } = useNavigation();
  const { tab, pages } = nav;
  const openArticle = (id: string) => openPage({ kind: 'article', id });
  const [calendarFocus, setCalendarFocus] = useState<{ start: string; length: number } | undefined>();
  const changeTab = (next: TabId) => {
    setCalendarFocus(undefined);
    selectTab(next);
  };
  const today = todayLocal();

  useEffect(() => {
    void init(dbName);
  }, [init, dbName]);

  const lock = useCallback(() => lockNow(), [lockNow]);
  useTheme(settings?.theme);
  // Passphrase mode always locks itself; device mode only with a PIN.
  useAutoLock((pinSet || protection === 'passphrase') && status === 'ready', settings?.lockMinutes ?? 5, lock);
  usePrivacyShield(!!settings?.privacyShield && status === 'ready', de.settings.shieldTap);

  if (status === 'loading') return null;
  if (status === 'error') return <LoadError />;
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
  // A plain function, not a component: a component defined here would remount on every render.
  const subPage = (page: Page) => {
    if (page.kind === 'method') return <Method onBack={back} onLearn={() => openArticle(CYCLE_ARTICLE_ID)} />;
    if (page.kind === 'import') {
      return <ImportPage source={page.source} onChoose={(source) => openPage({ kind: 'import', source })} onBack={back} onDone={() => changeTab('today')} />;
    }
    if (page.id === CYCLE_ARTICLE_ID) return <Learn onBack={back} />;
    const article = articleById(page.id);
    return article ? <ArticleView article={article} onBack={back} /> : null;
  };
  return (
    <>
      {page && subPage(page)}
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
            selectTab('calendar');
            setCalendarFocus({ start, length });
          }}
          onIncludeCycle={(c) => void includeCycle(c)}
          onImport={() => openPage({ kind: 'import' })}
          onMethod={() => openPage({ kind: 'method' })}
        />
      )}
      {!page && tab === 'calendar' && settings && (
        <Calendar
          logs={logs}
          settings={settings}
          prediction={prediction}
          today={today}
          onOpenDay={setSheetDate}
          onSavePeriods={(add, remove) => void setPeriodDays(add, remove)}
          onIncludeCycle={(c) => void includeCycle(c)}
          focus={calendarFocus}
        />
      )}
      {!page && tab === 'insights' && settings && (
        <Insights logs={logs} settings={settings} today={today} onMethod={() => openPage({ kind: 'method' })} onLearn={() => openArticle(CYCLE_ARTICLE_ID)} />
      )}
      {!page && tab === 'learn' && <Knowledge today={today} onOpen={openArticle} onMethod={() => openPage({ kind: 'method' })} />}
      {!page && tab === 'settings' && (
        <Settings
          prediction={prediction}
          today={today}
          onMethod={() => openPage({ kind: 'method' })}
          onImport={(source) => openPageOn('settings', { kind: 'import', source })}
        />
      )}
      <TabBar active={tab} onSelect={changeTab} />
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

/** Shown when the database cannot be opened. The code helps tell causes apart (e.g. private mode). */
function LoadError() {
  const code = useApp((s) => s.errorCode);
  const [reset, setReset] = useState(false);
  return (
    <main className="load-error">
      <p>{de.loadError}</p>
      {code && <p className="load-error-code">{de.loadErrorCode(code)}</p>}
      {/* Only in a browser tab: its storage is separate from the Home Screen app. */}
      {!isStandalone() && (
        <>
          <p className="load-error-hint">{de.loadErrorBrowser}</p>
          {reset ? <DeletePanel /> : <Button variant="quiet" onClick={() => setReset(true)}>{de.loadErrorReset}</Button>}
        </>
      )}
    </main>
  );
}
