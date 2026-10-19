import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { appStore } from '../state/store.ts';
import { App } from './App.tsx';

const click = (target: string | RegExp | HTMLElement) =>
  fireEvent.click(target instanceof HTMLElement ? target : screen.getByRole('button', { name: target }));
const typePin = (pin: string) => [...pin].forEach((d) => click(d));

afterEach(cleanup);

describe('App', () => {
  it('runs onboarding, sets a PIN, locks and unlocks', async () => {
    render(<App dbName="aya-app-test" />);

    expect(await screen.findByRole('heading', { name: 'Deine Daten bleiben bei dir' })).toBeTruthy();
    click('Weiter');
    expect(screen.getByRole('heading', { name: 'Wie soll aya deine Daten schützen?' })).toBeTruthy();
    click('Weiter');
    expect(await screen.findByRole('heading', { name: /letzte Periode/ })).toBeTruthy();
    click('Überspringen');
    fireEvent.click(screen.getByLabelText(/Kinderwunsch/));
    click('Weiter');
    expect(screen.getByText('aya ist kein Verhütungsmittel und kein Medizinprodukt.')).toBeTruthy();
    click('Los geht’s');

    expect(await screen.findByRole('heading', { name: 'Noch keine Periode eingetragen' })).toBeTruthy();
    expect(appStore.getState().settings?.mode).toBe('conceive');

    click('Periode begonnen');
    expect(await screen.findByRole('heading', { name: 'Tag 1 deiner Periode' })).toBeTruthy();
    click('Heute eintragen');
    const sheet = await screen.findByRole('dialog', { name: 'Heute' });
    // Conceive mode: temperature and tests come before the symptoms.
    const headings = within(sheet).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings.indexOf('Basaltemperatur')).toBeLessThan(headings.indexOf('Symptome'));
    const temp = within(sheet).getByLabelText('Temperatur in °C');
    fireEvent.change(temp, { target: { value: '36,48' } });
    fireEvent.blur(temp);
    fireEvent.click(within(sheet).getAllByRole('button', { name: 'positiv' })[0]!); // LH test
    fireEvent.click(within(sheet).getByRole('button', { name: 'Krämpfe' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'stark' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Fertig' }));
    expect(await screen.findByText((_, el) => el?.className === 'today-summary' && /stark, Krämpfe$/.test(el.textContent ?? ''))).toBeTruthy();
    const saved = appStore.getState().logs.at(-1)!;
    expect(saved.bbt).toEqual({ value: 36.48 });
    expect(saved.lhTest).toBe('positive');
    click('Periode beendet');
    expect(await screen.findByRole('button', { name: 'Periode begonnen' })).toBeTruthy();

    click('Einstellungen');
    click('PIN festlegen');
    typePin('135790');
    expect(await screen.findByRole('heading', { name: 'PIN wiederholen' })).toBeTruthy();
    typePin('135790');
    expect(await screen.findByText('An')).toBeTruthy();

    act(() => appStore.getState().lock());
    expect(await screen.findByRole('heading', { name: 'Gib deine PIN ein' })).toBeTruthy();
    typePin('111111');
    expect(await screen.findByText('Diese PIN stimmt nicht.')).toBeTruthy();
    typePin('135790');
    expect(await screen.findByRole('heading', { name: 'Einstellungen' })).toBeTruthy();

    // Removing the PIN asks for it first.
    click('PIN entfernen');
    expect(await screen.findByRole('heading', { name: 'Aktuelle PIN eingeben' })).toBeTruthy();
    typePin('000000');
    expect(await screen.findByText('Diese PIN stimmt nicht.')).toBeTruthy();
    expect(appStore.getState().pinSet).toBe(true);
    typePin('135790');
    expect(await screen.findByText('Aus')).toBeTruthy();
    expect(appStore.getState().pinSet).toBe(false);
  });

  it('opens Methodik from the logo and import from the empty Today screen', async () => {
    render(<App dbName="aya-app-test-pages" />);
    await screen.findByRole('heading', { name: 'Deine Daten bleiben bei dir' });
    click('Weiter');
    click('Weiter');
    await screen.findByRole('heading', { name: /letzte Periode/ });
    click('Überspringen');
    click('Weiter');
    expect(screen.getByRole('heading', { name: 'Wann du zur Ärztin gehen solltest' })).toBeTruthy();
    click('Los geht’s');
    await screen.findByRole('heading', { name: 'Noch keine Periode eingetragen' });
    expect(screen.getByRole('img', { name: /sobald du eine Periode einträgst/ })).toBeTruthy();

    click('Methodik und Quellen');
    expect(screen.getByRole('heading', { level: 1, name: 'Methodik und Quellen' })).toBeTruthy();
    click('Mehr über den Zyklus');
    expect(screen.getByRole('heading', { level: 1, name: 'Der Zyklus' })).toBeTruthy();
    // "Zurück" goes through the browser history, so the swipe back works the same way.
    click('Zurück');
    expect(await screen.findByRole('heading', { level: 1, name: 'Methodik und Quellen' })).toBeTruthy();
    click('Zurück');
    expect(await screen.findByRole('heading', { name: 'Noch keine Periode eingetragen' })).toBeTruthy();

    click('Alte Daten importieren');
    expect(screen.getByRole('heading', { level: 1, name: 'Alte Daten importieren' })).toBeTruthy();
    click(/^Apple Health/);
    expect(screen.getByRole('heading', { name: 'So bekommst du die Datei' })).toBeTruthy();
    expect((screen.getByLabelText('Datei') as HTMLInputElement).accept).toContain('.zip');
    click('Zurück');
    click(await screen.findByRole('button', { name: /^aya-Backup/ }));
    expect(screen.getByLabelText('Backup-Datei')).toBeTruthy();
    click('Zurück');
    await screen.findByRole('button', { name: /^aya-Backup/ });
    click('Zurück');
    expect(await screen.findByRole('heading', { name: 'Noch keine Periode eingetragen' })).toBeTruthy();

    // Five tabs; Wissen lists the articles.
    click('Wissen');
    expect(screen.getByRole('heading', { level: 1, name: 'Wissen' })).toBeTruthy();
    click(screen.getAllByRole('button', { name: /Regelschmerzen/ })[0]!);
    expect(screen.getByRole('heading', { level: 1, name: 'Regelschmerzen: Was wirklich hilft' })).toBeTruthy();
    click('Zurück');
    expect(await screen.findByRole('heading', { level: 1, name: 'Wissen' })).toBeTruthy();
  });

  it('back-fills a period range in the calendar after a confirmation', async () => {
    const { formatLongDate } = await import('../i18n/de.ts');
    const { addDays, todayLocal } = await import('../engine/dates.ts');
    const today = todayLocal();
    render(<App dbName="aya-app-test-calendar" />);
    await screen.findByRole('heading', { name: 'Deine Daten bleiben bei dir' });
    click('Weiter');
    click('Weiter');
    await screen.findByRole('heading', { name: /letzte Periode/ });
    click('Überspringen');
    click('Weiter');
    click('Los geht’s');
    await screen.findByRole('heading', { name: 'Noch keine Periode eingetragen' });

    click('Kalender');
    click('Periode nachtragen');
    const day = (offset: number) => screen.getByRole('button', { name: new RegExp(`^${formatLongDate(addDays(today, offset))}`) });
    click(day(-4));
    expect(screen.getByText(/Tippe jetzt auf den letzten Tag/)).toBeTruthy();
    click(day(-1));
    click('Fertig');
    const dialog = await screen.findByRole('dialog', { name: 'Stimmt das so?' });
    expect(within(dialog).getByText(/\(4 Tage\)/)).toBeTruthy();
    expect(appStore.getState().logs).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ja, speichern' }));
    await waitFor(() => expect(appStore.getState().logs.map((l) => l.date)).toEqual([-4, -3, -2, -1].map((o) => addDays(today, o))));
  });

  it('sets up a passphrase, shows the recovery code once and unlocks with it', { timeout: 60_000 }, async () => {
    const { unmount } = render(<App dbName="aya-app-test-pass" />);
    expect(await screen.findByRole('heading', { name: 'Deine Daten bleiben bei dir' })).toBeTruthy();
    click('Weiter');
    fireEvent.click(screen.getByLabelText(/Mit einer Passphrase/));
    const pass = screen.getByLabelText('Passphrase');
    const repeat = screen.getByLabelText('Noch einmal eingeben');
    fireEvent.change(pass, { target: { value: 'kurz' } });
    fireEvent.change(repeat, { target: { value: 'kurz' } });
    click('Weiter');
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.change(pass, { target: { value: 'mein geheimer satz fuer aya' } });
    fireEvent.change(repeat, { target: { value: 'mein geheimer satz fuer aya' } });
    click('Weiter');

    expect(await screen.findByRole('heading', { name: 'Dein Wiederherstellungscode' }, { timeout: 30_000 })).toBeTruthy();
    const code = document.querySelector('.recovery-code')!.textContent!;
    expect(code.replace(/ /g, '')).toMatch(/^[A-Z2-7]{26}$/);
    expect((screen.getByRole('button', { name: 'Weiter' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Ich habe den Code notiert.'));
    click('Weiter');
    expect(screen.queryByText(code)).toBeNull();
    click('Überspringen');
    click('Weiter');
    click('Los geht’s');
    expect(await screen.findByRole('heading', { name: 'Noch keine Periode eingetragen' })).toBeTruthy();

    act(() => appStore.getState().lock());
    expect(await screen.findByRole('heading', { name: 'aya ist gesperrt' })).toBeTruthy();
    const field = screen.getByLabelText('Passphrase oder Wiederherstellungscode');
    fireEvent.change(field, { target: { value: 'falscher satz fuer aya hier' } });
    click('Entsperren');
    expect(await screen.findByRole('alert', {}, { timeout: 30_000 })).toBeTruthy();
    fireEvent.change(field, { target: { value: code.toLowerCase() } });
    click('Entsperren');
    expect(await screen.findByRole('heading', { name: 'Noch keine Periode eingetragen' }, { timeout: 30_000 })).toBeTruthy();
    unmount();
  });

  it('imports a CSV through the mapping preview', { timeout: 30_000 }, async () => {
    const { readFileSync } = await import('node:fs');
    const csv = readFileSync(`${process.cwd()}/docs/import-vorlagen/perioden.csv`, 'utf8');
    render(<App dbName="aya-app-test-import" />);
    await screen.findByRole('heading', { name: 'Deine Daten bleiben bei dir' });
    click('Weiter');
    click('Weiter');
    await screen.findByRole('heading', { name: /letzte Periode/ });
    click('Überspringen');
    click('Weiter');
    click('Los geht’s');
    await screen.findByRole('heading', { name: 'Noch keine Periode eingetragen' });

    click('Einstellungen');
    click(/^Andere App oder Tabelle/);
    const input = screen.getByLabelText('Datei');
    fireEvent.change(input, { target: { files: [new File([csv], 'perioden.csv', { type: 'text/csv' })] } });
    expect(await screen.findByText('45 Tage gefunden, davon 45 mit Periode.')).toBeTruthy();
    expect((screen.getByLabelText('Periodenende') as HTMLSelectElement).value).toBe('1');
    click('Importieren');
    expect(await screen.findByText('Importiert: 45 Tage.')).toBeTruthy();
    expect(appStore.getState().logs).toHaveLength(45);
  });

  it('shows the recovery code after switching to passphrase in the settings', { timeout: 60_000 }, async () => {
    render(<App dbName="aya-app-test-switch" />);
    await screen.findByRole('heading', { name: 'Deine Daten bleiben bei dir' });
    click('Weiter');
    click('Weiter');
    await screen.findByRole('heading', { name: /letzte Periode/ });
    click('Überspringen');
    click('Weiter');
    click('Los geht’s');
    await screen.findByRole('heading', { name: 'Noch keine Periode eingetragen' });
    await act(async () => void (await appStore.getState().exportBackup('backup-passwort')));

    click('Einstellungen');
    fireEvent.click(screen.getByLabelText(/Mit einer Passphrase/));
    fireEvent.change(screen.getByLabelText('Neue Passphrase'), { target: { value: 'mein geheimer satz fuer aya' } });
    fireEvent.change(screen.getByLabelText('Noch einmal eingeben'), { target: { value: 'mein geheimer satz fuer aya' } });
    click('Bestätigen');
    await waitFor(() => expect(document.querySelector('.recovery-code')?.textContent).toMatch(/^([A-Z2-7]{4} ){6}[A-Z2-7]{2}$/), { timeout: 30_000 });
    expect(appStore.getState().protection).toBe('passphrase');
    fireEvent.click(screen.getByLabelText('Ich habe den Code notiert.'));
    click('Fertig');
    expect(document.querySelector('.recovery-code')).toBeNull();
    expect(screen.getByRole('button', { name: 'Passphrase ändern' })).toBeTruthy();
  });
});

