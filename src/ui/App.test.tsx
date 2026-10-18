import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { appStore } from '../state/store.ts';
import { App } from './App.tsx';

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
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
});
