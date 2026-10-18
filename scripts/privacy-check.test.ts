import { describe, expect, it } from 'vitest';
import { checkCsp, scanText } from './privacy-check.ts';

describe('scanText', () => {
  it('flags network APIs and external URLs', () => {
    const rules = scanText('x.ts', 'fetch("/a")\nnew WebSocket(u)\nconst u = "https://evil.example"').map((f) => f.rule);
    expect(rules).toEqual(['fetch', 'WebSocket', 'external-url']);
  });

  it('allows SVG namespace URLs and clean code', () => {
    expect(scanText('x.ts', 'xmlns="http://www.w3.org/2000/svg"\nconst a = 1;')).toEqual([]);
  });
});

describe('checkCsp', () => {
  const meta = (c: string) => `<meta http-equiv="Content-Security-Policy" content="${c}" />`;

  it('accepts a strict CSP', () => {
    expect(checkCsp(meta("default-src 'self'; connect-src 'none'"))).toEqual([]);
  });

  it('rejects missing or weak CSP', () => {
    expect(checkCsp('<html></html>')).toHaveLength(1);
    expect(checkCsp(meta("default-src 'self'; connect-src *; script-src 'unsafe-eval'"))).toHaveLength(2);
  });
});
