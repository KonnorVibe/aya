import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { appStore } from '../state/store.ts';
import { App } from './App.tsx';

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const typePin = (pin: string) => [...pin].forEach((d) => click(d));

describe('App', () => {
  it('runs onboarding, sets a PIN, locks and unlocks', async () => {
    render(<App dbName="aya-app-test" />);

    expect(await screen.findByRole('heading', { name: 'Deine Daten bleiben bei dir' })).toBeTruthy();
    click('Weiter');
    expect(screen.getByRole('heading', { name: /letzte Periode/ })).toBeTruthy();
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
    fireEvent.click(within(sheet).getByRole('button', { name: 'Krämpfe' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'stark' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Fertig' }));
    expect(await screen.findByText((_, el) => el?.className === 'today-summary' && /stark, Krämpfe$/.test(el.textContent ?? ''))).toBeTruthy();
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
});
