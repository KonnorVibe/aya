import { describe, expect, it } from 'vitest';
import { ARTICLES, CATEGORY_LABEL, CYCLE_ARTICLE_ID, isNew } from './articles.ts';

describe('articles', () => {
  it('have unique ids, known categories and content', () => {
    expect(new Set(ARTICLES.map((a) => a.id)).size).toBe(ARTICLES.length);
    for (const a of ARTICLES) {
      expect(CATEGORY_LABEL[a.category]).toBeTruthy();
      if (a.id !== CYCLE_ARTICLE_ID) expect(a.blocks.length).toBeGreaterThan(0);
    }
  });

  it('count as new for 30 days', () => {
    const a = ARTICLES[1]!;
    expect(isNew({ ...a, added: '2026-10-01' }, '2026-10-30')).toBe(true);
    expect(isNew({ ...a, added: '2026-10-01' }, '2026-10-31')).toBe(false);
    expect(isNew({ ...a, added: '2026-11-01' }, '2026-10-31')).toBe(false);
  });
});
