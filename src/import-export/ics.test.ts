import { describe, expect, it } from 'vitest';
import { buildIcs } from './ics.ts';

describe('buildIcs', () => {
  const ics = buildIcs(['2026-10-31', '2026-11-28'], 'Notiz, privat', new Date('2026-10-17T08:00:00Z'));

  it('writes one all-day event per start with CRLF lines', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261031\r\nDTEND;VALUE=DATE:20261101');
    expect(ics).toContain('DTSTAMP:20261017T080000Z');
    expect(ics).toContain('SUMMARY:Notiz\\, privat');
    expect(ics.split('\r\n').every((l) => !l.includes('\n'))).toBe(true);
  });

  it('escapes semicolons and backslashes', () => {
    expect(buildIcs(['2026-10-31'], 'a;b\\c')).toContain('SUMMARY:a\\;b\\\\c\r\n');
  });

  it('falls back to the neutral default title', () => {
    expect(buildIcs(['2026-10-31'], '  ')).toContain('SUMMARY:a\r\n');
  });
});
