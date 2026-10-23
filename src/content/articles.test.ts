import { describe, expect, it } from 'vitest';
import { ARTICLES, CATEGORY_LABEL, CYCLE_ARTICLE_ID } from './articles.ts';

describe('articles', () => {
  it('have unique ids, known categories and content', () => {
    expect(new Set(ARTICLES.map((a) => a.id)).size).toBe(ARTICLES.length);
    for (const a of ARTICLES) {
      expect(CATEGORY_LABEL[a.category]).toBeTruthy();
      if (a.id !== CYCLE_ARTICLE_ID) expect(a.blocks.length).toBeGreaterThan(0);
    }
  });

  it('each end with a question whose answer is one of its options', () => {
    for (const a of ARTICLES) {
      expect(a.quiz.options.length).toBeGreaterThanOrEqual(2);
      expect(a.quiz.options[a.quiz.answer]).toBeTruthy();
    }
  });
});
