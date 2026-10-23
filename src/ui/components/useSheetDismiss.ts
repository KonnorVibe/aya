import { useEffect, type RefObject } from 'react';

const DISMISS_DISTANCE = 90;

/**
 * Bottom sheets close like on iOS: a tap on the dimmed area outside, or a swipe down that starts
 * on the handle or header, or anywhere while the content is scrolled to the top. The sheet follows
 * the finger and springs back if the swipe stays short.
 */
export function useSheetDismiss(ref: RefObject<HTMLDialogElement | null>, onDismiss: () => void) {
  useEffect(() => {
    const sheet = ref.current;
    if (!sheet) return;

    // A click on the backdrop reports the dialog itself as target, outside its box.
    const click = (e: MouseEvent) => {
      if (e.target !== sheet) return;
      const r = sheet.getBoundingClientRect();
      const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      if (outside) onDismiss();
    };

    let startY: number | null = null;
    let dy = 0;
    const scroller = () => sheet.querySelector<HTMLElement>('.sheet-body');
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || e.touches.length !== 1) return;
      const onHead = (e.target as HTMLElement).closest('.sheet-head, .sheet-grabber');
      const atTop = (scroller()?.scrollTop ?? 0) <= 0;
      startY = onHead || atTop ? t.clientY : null;
      dy = 0;
    };
    const move = (e: TouchEvent) => {
      const t = e.touches[0];
      if (startY === null || !t) return;
      dy = Math.max(0, t.clientY - startY);
      sheet.style.transition = 'none';
      sheet.style.transform = dy ? `translateY(${dy}px)` : '';
    };
    const up = () => {
      if (startY === null) return;
      startY = null;
      sheet.style.transition = 'transform 220ms ease-out';
      if (dy > DISMISS_DISTANCE) {
        sheet.style.transform = 'translateY(100%)';
        window.setTimeout(onDismiss, 180);
      } else {
        sheet.style.transform = '';
      }
    };

    sheet.addEventListener('click', click);
    sheet.addEventListener('touchstart', down, { passive: true });
    sheet.addEventListener('touchmove', move, { passive: true });
    sheet.addEventListener('touchend', up);
    sheet.addEventListener('touchcancel', up);
    return () => {
      sheet.removeEventListener('click', click);
      sheet.removeEventListener('touchstart', down);
      sheet.removeEventListener('touchmove', move);
      sheet.removeEventListener('touchend', up);
      sheet.removeEventListener('touchcancel', up);
    };
  }, [ref, onDismiss]);
}
