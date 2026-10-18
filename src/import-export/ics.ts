import { addDays, type ISODate } from '../engine/dates.ts';

export const DEFAULT_ICS_TITLE = 'a';

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

const compact = (d: ISODate) => d.replace(/-/g, '');

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * iCalendar file with one all-day event per expected period start. The title is neutral and
 * user-chosen; nothing else about the cycle goes into the file. Lines end in CRLF (RFC 5545).
 */
export function buildIcs(starts: readonly ISODate[], title: string, now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//aya//aya//DE', 'CALSCALE:GREGORIAN'];
  for (const start of starts) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${compact(start)}-${crypto.randomUUID()}@aya.local`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${compact(start)}`,
      `DTEND;VALUE=DATE:${compact(addDays(start, 1))}`,
      `SUMMARY:${escapeText(title.trim() || DEFAULT_ICS_TITLE)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
