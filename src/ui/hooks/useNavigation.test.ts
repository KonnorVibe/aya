import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useNavigation } from './useNavigation.ts';

const touch = (type: string, x: number, y = 300) => {
  const e = new Event(type, { bubbles: true });
  Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [{ clientX: x, clientY: y }] });
  window.dispatchEvent(e);
};
const swipeBack = () =>
  act(() => {
    touch('touchstart', 10);
    touch('touchmove', 50);
    touch('touchmove', 90);
    touch('touchend', 90);
  });

describe('useNavigation in the Home Screen app (memory)', () => {
  it('goes back one screen per swipe, across tabs and pages, and stops at the start', () => {
    const { result } = renderHook(() => useNavigation({ memory: true }));
    const where = () => `${result.current.nav.tab}${result.current.nav.pages.map((p) => `/${p.kind}`).join('')}`;
    act(() => result.current.selectTab('calendar'));
    act(() => result.current.selectTab('insights'));
    act(() => result.current.openPage({ kind: 'method' }));
    act(() => result.current.selectTab('learn'));
    act(() => result.current.openPage({ kind: 'article', id: 'pms' }));
    expect(where()).toBe('learn/article');

    swipeBack();
    expect(where()).toBe('learn');
    swipeBack();
    expect(where()).toBe('insights/method');
    act(() => result.current.back());
    expect(where()).toBe('insights');
    swipeBack();
    expect(where()).toBe('calendar');
    swipeBack();
    expect(where()).toBe('today');
    swipeBack();
    expect(where()).toBe('today');
  });

  it('leaves the browser history alone', () => {
    const before = window.history.length;
    const { result } = renderHook(() => useNavigation({ memory: true }));
    act(() => result.current.selectTab('calendar'));
    act(() => result.current.openPage({ kind: 'method' }));
    expect(window.history.length).toBe(before);
  });

  it('ignores a swipe that does not start at the edge', () => {
    const { result } = renderHook(() => useNavigation({ memory: true }));
    act(() => result.current.selectTab('calendar'));
    act(() => {
      touch('touchstart', 120);
      touch('touchmove', 260);
      touch('touchend', 260);
    });
    expect(result.current.nav.tab).toBe('calendar');
  });
});

describe('useNavigation in Safari (history)', () => {
  it('writes one history entry per screen', () => {
    const before = window.history.length;
    const { result } = renderHook(() => useNavigation({ memory: false }));
    act(() => result.current.selectTab('calendar'));
    act(() => result.current.openPage({ kind: 'method' }));
    expect(window.history.length).toBe(before + 2);
  });
});
