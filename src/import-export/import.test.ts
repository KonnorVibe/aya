// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { predict } from '../engine/prediction.ts';
import type { DayLog } from '../engine/types.ts';
import { parseHealthExport } from './appleHealth.ts';
import { detectFile } from './detect.ts';
import { csvToTable, guessMapping, jsonToTables, logsToCsv, mergeImported, parseCsv, parseDate, tableToLogs } from './tabular.ts';

const sample = (name: string) => readFileSync(new URL(`../../docs/import-vorlagen/${name}`, import.meta.url), 'utf8');
const asFile = (text: string | Uint8Array<ArrayBuffer>, name: string) => Object.assign(new Blob([text]), { name });

describe('CSV parsing and dates', () => {
  it('detects ; , and tab, honours quotes and a BOM', () => {
    expect(parseCsv('﻿Datum;Notiz\n16.10.2026;"a;b ""c"""\n')).toEqual([['Datum', 'Notiz'], ['16.10.2026', 'a;b "c"']]);
    expect(parseCsv('date,flow\r\n2026-10-16,heavy')).toEqual([['date', 'flow'], ['2026-10-16', 'heavy']]);
    expect(parseCsv('date\tflow\n2026-10-16\tlight')).toEqual([['date', 'flow'], ['2026-10-16', 'light']]);
  });

  it('reads four date formats and rejects impossible dates', () => {
    expect(parseDate('16.10.2026', 'de')).toBe('2026-10-16');
    expect(parseDate('6.3.2026', 'de')).toBe('2026-03-06');
    expect(parseDate('10/16/2026', 'us')).toBe('2026-10-16');
    expect(parseDate('2026-10-16T08:00:00Z', 'iso')).toBe('2026-10-16');
    expect(parseDate(String(Date.UTC(2026, 9, 16, 12) / 1000), 'unix')).toBe('2026-10-16');
    expect(parseDate(String(Date.UTC(2026, 9, 16, 12)), 'unix')).toBe('2026-10-16');
    expect(parseDate('31.02.2026', 'de')).toBeUndefined();
  });
});

describe('template: perioden.csv (one row per period)', () => {
  const table = csvToTable(sample('perioden.csv'));
  const mapping = guessMapping(table)!;

  it('guesses start, end, strength and symptoms from the German header', () => {
    expect(table.header).toEqual(['Beginn', 'Ende', 'Stärke', 'Symptome']);
    expect(mapping).toEqual({ date: 0, end: 1, flow: 2, symptoms: 3, dateFormat: 'de' });
  });

  it('fills every period day and keeps symptoms on the first day', () => {
    const r = tableToLogs(table, mapping);
    expect(r.errors).toEqual([]);
    expect(r.periodDays).toBe(45);
    expect(r.logs[0]).toEqual({ date: '2026-02-03', flow: 'heavy', symptoms: ['cramps', 'headache'] });
    expect(r.logs[1]).toEqual({ date: '2026-02-04', flow: 'heavy' });
  });

  it('reports unreadable rows instead of guessing', () => {
    const t = csvToTable('Beginn;Ende\n03.02.2026;07.02.2026\nirgendwann;\n;\n');
    expect(tableToLogs(t, guessMapping(t)!).errors).toEqual([{ row: 2, value: 'irgendwann' }]);
  });
});

describe('template: flo-beispiel.json (invented nested structure)', () => {
  it('finds the period list among several arrays and maps start and end', () => {
    const tables = jsonToTables(sample('flo-beispiel.json'));
    expect(tables[0]!.path).toBe('operationalData.cycles');
    const mapping = guessMapping(tables[0]!.table)!;
    const header = tables[0]!.table.header;
    expect(header[mapping.date]).toBe('period_start_date');
    expect(header[mapping.end!]).toBe('period_end_date');
    expect(mapping.flow).toBeUndefined();
    const r = tableToLogs(tables[0]!.table, mapping);
    expect(r.periodDays).toBe(45);
    expect(r.logs.every((l) => l.flow === 'medium')).toBe(true);
  });

  it('also reads a flat per-day list with English flow words', () => {
    const json = JSON.stringify([{ day: '2026-05-01', flow: 'heavy' }, { day: '2026-05-02', flow: 'light' }, { day: '2026-05-03', flow: 'none' }]);
    const t = jsonToTables(json)[0]!.table;
    const r = tableToLogs(t, guessMapping(t)!);
    expect(r.logs).toEqual([{ date: '2026-05-01', flow: 'heavy' }, { date: '2026-05-02', flow: 'light' }]);
  });
});

describe('template: apple-health-export.xml', () => {
  const xml = sample('apple-health-export.xml');

  it('keeps cycle records, skips the rest, survives any chunk split', async () => {
    const whole = await parseHealthExport([xml]);
    const chunks: string[] = [];
    for (let i = 0; i < xml.length; i += 97) chunks.push(xml.slice(i, i + 97));
    const split = await parseHealthExport(chunks);
    expect(split).toEqual(whole);

    expect(whole.periodDays).toBe(45);
    expect(whole.sources).toEqual({ Flo: 45 + 22 + 1, 'Zyklus & Co': 1 });
    const temps = whole.logs.filter((l) => l.bbt);
    expect(temps).toHaveLength(22);
    expect(temps[0]!.bbt).toEqual({ value: 36.43, time: '06:35' });
    expect(whole.logs.some((l) => l.lhTest === 'positive')).toBe(true);
    expect(whole.logs.find((l) => l.date === '2026-03-04')).toMatchObject({ flow: 'heavy', symptoms: ['cramps'] });
  });

  it('feeds the engine: the imported temperature rise confirms ovulation', async () => {
    const { logs } = await parseHealthExport([xml]);
    const lastStart = '2026-08-24'; // the template's temperature cycle
    const past = logs.filter((l) => l.date <= '2026-09-20' && l.date >= '2026-02-01');
    const p = predict({ logs: past, settings: { mode: 'track' }, today: '2026-09-20' })!;
    expect(p.cycleStart).toBe(lastStart);
    expect(p.basis).not.toBe('history');
  });

  it('converts Fahrenheit and ignores sexual activity without a protection flag', async () => {
    const r = await parseHealthExport([
      '<Record type="HKQuantityTypeIdentifierBasalBodyTemperature" unit="degF" startDate="2026-01-01 06:00:00 +0100" value="97.7"/>',
      '<Record type="HKCategoryTypeIdentifierSexualActivity" startDate="2026-01-02 22:00:00 +0100" value="HKCategoryValueNotApplicable"/>',
      '<Record type="HKCategoryTypeIdentifierSexualActivity" startDate="2026-01-03 22:00:00 +0100" value="HKCategoryValueNotApplicable">\n<MetadataEntry key="HKSexualActivityProtectionUsed" value="1"/>\n</Record>',
    ]);
    expect(r.logs).toEqual([
      { date: '2026-01-01', bbt: { value: 36.5, time: '06:00' } },
      { date: '2026-01-03', sex: [{ protected: true }] },
    ]);
  });
});

/** Minimal ZIP writer for the test (stored or deflated, no CRC check needed by the reader). */
async function zip(name: string, text: string, deflate: boolean): Promise<Uint8Array<ArrayBuffer>> {
  const plain = new TextEncoder().encode(text);
  const data = deflate
    ? new Uint8Array(await new Response(new Blob([plain]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())
    : plain;
  const n = new TextEncoder().encode(name);
  const local = new DataView(new ArrayBuffer(30));
  local.setUint32(0, 0x04034b50, true);
  local.setUint16(8, deflate ? 8 : 0, true);
  local.setUint32(18, data.length, true);
  local.setUint32(22, plain.length, true);
  local.setUint16(26, n.length, true);
  const cd = new DataView(new ArrayBuffer(46));
  cd.setUint32(0, 0x02014b50, true);
  cd.setUint16(10, deflate ? 8 : 0, true);
  cd.setUint32(20, data.length, true);
  cd.setUint32(24, plain.length, true);
  cd.setUint16(28, n.length, true);
  cd.setUint32(42, 0, true);
  const cdOffset = 30 + n.length + data.length;
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, 1, true);
  eocd.setUint16(10, 1, true);
  eocd.setUint32(12, 46 + n.length, true);
  eocd.setUint32(16, cdOffset, true);
  const parts: Uint8Array[] = [new Uint8Array(local.buffer), n, data, new Uint8Array(cd.buffer), n, new Uint8Array(eocd.buffer)];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) out.set(p, (o += p.length) - p.length);
  return out;
}

describe('detectFile', () => {
  it('opens an Apple Health export.zip (deflated and stored)', async () => {
    for (const deflate of [true, false]) {
      const bytes = await zip('apple_health_export/export.xml', sample('apple-health-export.xml'), deflate);
      const d = await detectFile(asFile(bytes, 'export.zip'));
      expect(d.kind).toBe('logs');
      if (d.kind === 'logs') expect(d.result.periodDays).toBe(45);
    }
  });

  it('reports a ZIP without a Health export', async () => {
    const d = await detectFile(asFile(await zip('fotos/bild.txt', 'x', false), 'archiv.zip'));
    expect(d).toEqual({ kind: 'unknown', reason: 'zip-without-health' });
  });

  it('routes CSV and JSON to the mapping step', async () => {
    const csv = await detectFile(asFile(sample('perioden.csv'), 'perioden.csv'));
    expect(csv.kind === 'table' && csv.mapping?.end).toBe(1);
    const json = await detectFile(asFile(sample('flo-beispiel.json'), 'flo.json'));
    expect(json.kind === 'table' && json.source).toBe('json');
    expect(await detectFile(asFile('', 'leer.csv'))).toEqual({ kind: 'unknown', reason: 'empty' });
    expect(await detectFile(asFile('{"a":', 'kaputt.json'))).toEqual({ kind: 'unknown', reason: 'unreadable' });
  });

  it('round-trips aya CSV without losing a field', async () => {
    const logs: DayLog[] = [
      { date: '2026-10-01', flow: 'heavy', symptoms: ['cramps', 'back_pain'], mood: ['calm'], energy: 2, sleepQuality: 4 },
      { date: '2026-10-02', flow: 'light', periodEnd: true, note: 'Notiz; mit "Zeichen"\nund Zeile' },
      { date: '2026-10-15', bbt: { value: 36.62, time: '06:30', disturbed: true }, lhTest: 'peak', cervicalMucus: 'eggwhite', sex: [{ protected: false }], medication: ['Eisen'] },
      { date: '2026-10-29', pregnancyTest: 'negative' },
    ];
    const d = await detectFile(asFile(logsToCsv(logs), 'aya-export.csv'));
    expect(d.kind === 'logs' && d.source).toBe('aya-csv');
    if (d.kind === 'logs') expect(d.result.logs).toEqual(logs);
  });
});

describe('merging imported days', () => {
  it('keeps existing fields and combines symptoms', () => {
    const existing: DayLog[] = [{ date: '2026-01-01', note: 'eigene Notiz', symptoms: ['acne'] }];
    expect(mergeImported(existing, [{ date: '2026-01-01', flow: 'heavy', symptoms: ['cramps'] }, { date: '2026-01-02', flow: 'light' }])).toEqual([
      { date: '2026-01-01', note: 'eigene Notiz', flow: 'heavy', symptoms: ['acne', 'cramps'] },
      { date: '2026-01-02', flow: 'light' },
    ]);
  });
});
