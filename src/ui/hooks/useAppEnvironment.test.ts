import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHIELD_IDLE_MS, usePrivacyShield } from './useAppEnvironment.ts';

const shielded = () => document.documentElement.hasAttribute('data-shield');

afterEach(() => vi.useRealTimers());

describe('usePrivacyShield', () => {
  it('covers after the idle time and on blur, and a tap uncovers', () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => usePrivacyShield(true, 'Tippen zum Anzeigen'));
    expect(shielded()).toBe(false);
    vi.advanceTimersByTime(SHIELD_IDLE_MS - 1);
    expect(shielded()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(shielded()).toBe(true);
    expect(document.body.getAttribute('data-shield-hint')).toBe('Tippen zum Anzeigen');

    window.dispatchEvent(new Event('pointerdown'));
    expect(shielded()).toBe(false);
    window.dispatchEvent(new Event('blur'));
    expect(shielded()).toBe(true);

    unmount();
    expect(shielded()).toBe(false);
  });

  it('does nothing when switched off', () => {
    vi.useFakeTimers();
    renderHook(() => usePrivacyShield(false, ''));
    vi.advanceTimersByTime(SHIELD_IDLE_MS * 2);
    window.dispatchEvent(new Event('blur'));
    expect(shielded()).toBe(false);
  });
});
