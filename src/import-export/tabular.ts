import { addDays, eachDay, isISODate, type ISODate } from '../engine/dates.ts';
import { SYMPTOM_IDS, type DayLog, type Flow, type SymptomId } from '../engine/types.ts';

/**
 * CSV and JSON import with a column mapping. Flo and most other apps hand out their data only on
 * request and without a guaranteed format, so nothing here assumes a fixed schema: the file is
 * turned into a table, a mapping is guessed from column names and sample values, and the user
 * checks and corrects it in a preview before anything is written.
 */

export type Table = { header: string[]; rows: string[][] };

/** Splits CSV text into rows, detecting ';', ',' or tab, honouring double-quoted fields. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const count = (c: string) => firstLine.split(c).length - 1;
  const sep = [';', ',', '\t'].sort((a, b) => count(b) - count(a))[0]!;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((f) => f.trim()));
}

export function csvToTable(text: string): Table {
  const rows = parseCsv(text);
  const looksLikeHeader = rows[0] && !rows[0].some((c) => detectDate(c));
  return looksLikeHeader ? { header: rows[0]!, rows: rows.slice(1) } : { header: (rows[0] ?? []).map((_, i) => `Spalte ${i + 1}`), rows };
}

const DATE_WORDS = /period|cycle|menstru|blut|zyklus|regel|bleed|flow/i;

/** Every array of objects in the JSON, flattened one level ("period.start"), best candidate first. */
export function jsonToTables(text: string): { path: string; table: Table }[] {
  const data = JSON.parse(text) as unknown;
  const found: { path: string; items: Record<string, unknown>[] }[] = [];
  const walk = (v: unknown, path: string, depth: number) => {
    if (depth > 6) return;
    if (Array.isArray(v)) {
      const objects = v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x));
      if (objects.length && objects.length >= v.length / 2) found.push({ path: path || '(Wurzel)', items: objects });
      v.slice(0, 3).forEach((x, i) => walk(x, `${path}[${i}]`, depth + 1));
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k, depth + 1);
    }
  };
  walk(data, '', 0);

  const flatten = (o: Record<string, unknown>) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [k2, v2] of Object.entries(v)) out[`${k}.${k2}`] = cell(v2);
      } else out[k] = cell(v);
    }
    return out;
  };
  const tables = found.map(({ path, items }) => {
    const flat = items.map(flatten);
    const header = [...new Set(flat.flatMap((o) => Object.keys(o)))];
    return { path, table: { header, rows: flat.map((o) => header.map((h) => o[h] ?? '')) } };
  });
  const score = ({ path, table }: { path: string; table: Table }) => {
    const dateCols = table.header.filter((_, i) => table.rows.slice(0, 20).some((r) => detectDate(r[i] ?? ''))).length;
    return (DATE_WORDS.test(path) ? 1000 : 0) + (dateCols ? 500 + dateCols * 10 : 0) + Math.min(table.rows.length, 400);
  };
  return tables.sort((a, b) => score(b) - score(a));
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === 'object' ? JSON.stringify(x) : String(x))).join('|');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export type DateFormat = 'iso' | 'de' | 'us' | 'unix';
export const DATE_FORMATS: DateFormat[] = ['iso', 'de', 'us', 'unix'];

/** Reads a date in the given format. ISO accepts a time part; "unix" is seconds or milliseconds. */
export function parseDate(value: string, format: DateFormat): ISODate | undefined {
  const v = value.trim();
  if (!v) return undefined;
  let y: string | undefined, m: string | undefined, d: string | undefined;
  if (format === 'unix') {
    if (!/^\d{9,13}$/.test(v)) return undefined;
    const n = Number(v);
    const date = new Date(v.length > 10 ? n : n * 1000);
    // Local calendar day of the timestamp.
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return isISODate(iso) ? iso : undefined;
  }
  if (format === 'iso') [y, m, d] = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v)?.slice(1) ?? [];
  else if (format === 'de') [d, m, y] = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(v)?.slice(1) ?? [];
  else [m, d, y] = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v)?.slice(1) ?? [];
  if (!y || !m || !d) return undefined;
  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return isISODate(iso) ? iso : undefined;
}

export function detectDate(value: string): DateFormat | undefined {
  return DATE_FORMATS.find((f) => parseDate(value, f) && (f !== 'unix' || Number(value) > 946684800));
}

export function guessDateFormat(samples: string[]): DateFormat {
  const counts = DATE_FORMATS.map((f) => [f, samples.filter((s) => parseDate(s, f)).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0]![0];
}

export interface Mapping {
  /** Column holding the day (or the first day of a period). */
  date: number;
  /** Optional last day of the period: the days in between are filled. */
  end?: number;
  /** Optional bleeding strength per row; without it every row counts as medium bleeding. */
  flow?: number;
  symptoms?: number;
  dateFormat: DateFormat;
}

const NAME = {
  date: /^(date|datum|day|tag|start|begin|beginn|from|von|period.?start|start.?date|startdate|cycle.?start|begin.?date|periodstart|started)/i,
  end: /^(end|ende|to|bis|period.?end|end.?date|enddate|finish|ended)/i,
  flow: /(flow|intensity|intensität|stärke|staerke|blutung|bleeding|strength|menstrual.?flow)/i,
  symptoms: /(symptom|beschwerde)/i,
};

/** Best guess from column names and sample values; the user can change every choice. */
export function guessMapping(table: Table): Mapping | undefined {
  const sample = table.rows.slice(0, 50);
  const dateCols = table.header.map((_, i) => i).filter((i) => sample.some((r) => detectDate(r[i] ?? '')));
  if (!dateCols.length) return undefined;
  const byName = (re: RegExp, pool: number[]) => pool.find((i) => re.test(table.header[i] ?? '') || re.test((table.header[i] ?? '').split('.').pop() ?? ''));
  const date = byName(NAME.date, dateCols) ?? dateCols[0]!;
  const end = byName(NAME.end, dateCols.filter((i) => i !== date));
  const flow = byName(NAME.flow, table.header.map((_, i) => i).filter((i) => !dateCols.includes(i)));
  const symptoms = byName(NAME.symptoms, table.header.map((_, i) => i).filter((i) => !dateCols.includes(i)));
  return {
    date,
    ...(end !== undefined ? { end } : {}),
    ...(flow !== undefined ? { flow } : {}),
    ...(symptoms !== undefined ? { symptoms } : {}),
    dateFormat: guessDateFormat(sample.map((r) => r[date] ?? '')),
  };
}

const FLOW_WORDS: Record<string, Flow | null> = {
  spotting: 'spotting', schmierblutung: 'spotting', light: 'light', leicht: 'light', low: 'light', schwach: 'light',
  medium: 'medium', mittel: 'medium', moderate: 'medium', normal: 'medium', heavy: 'heavy', stark: 'heavy', high: 'heavy',
  '1': 'light', '2': 'medium', '3': 'heavy', none: null, keine: null, no: null, '0': null,
};

const SYMPTOM_WORDS: Record<string, SymptomId> = {
  cramps: 'cramps', krämpfe: 'cramps', headache: 'headache', kopfschmerzen: 'headache', migraine: 'migraine', migräne: 'migraine',
  'tender breasts': 'breast_tenderness', 'breast tenderness': 'breast_tenderness', brustspannen: 'breast_tenderness',
  bloating: 'bloating', blähungen: 'bloating', 'back pain': 'back_pain', backache: 'back_pain', rückenschmerzen: 'back_pain',
  nausea: 'nausea', übelkeit: 'nausea', acne: 'acne', akne: 'acne', fatigue: 'fatigue', tiredness: 'fatigue', müdigkeit: 'fatigue',
  cravings: 'cravings', heißhunger: 'cravings', diarrhea: 'diarrhea', durchfall: 'diarrhea', constipation: 'constipation',
  verstopfung: 'constipation', insomnia: 'insomnia', schlafprobleme: 'insomnia', dizziness: 'dizziness', schwindel: 'dizziness',
  'joint pain': 'joint_pain', gelenkschmerzen: 'joint_pain', 'high libido': 'libido_high', 'low libido': 'libido_low',
};

export interface ImportResult {
  logs: DayLog[];
  /** Rows whose date could not be read (1-based, counting data rows only). */
  errors: { row: number; value: string }[];
  /** Days that ended up with bleeding. */
  periodDays: number;
}

const MAX_PERIOD_DAYS = 15;

/** Turns mapped rows into day logs. Unreadable rows are reported, never guessed. */
export function tableToLogs(table: Table, map: Mapping): ImportResult {
  const out = new Map<ISODate, DayLog>();
  const errors: ImportResult['errors'] = [];
  table.rows.forEach((r, i) => {
    const raw = r[map.date] ?? '';
    const date = parseDate(raw, map.dateFormat);
    if (!date) {
      if (raw.trim()) errors.push({ row: i + 1, value: raw });
      return;
    }
    let flow: Flow | null = 'medium';
    if (map.flow !== undefined) {
      const word = (r[map.flow] ?? '').trim().toLowerCase().replace(/^hkcategoryvaluemenstrualflow/, '');
      flow = word in FLOW_WORDS ? FLOW_WORDS[word]! : word ? 'medium' : null;
    }
    const endRaw = map.end !== undefined ? r[map.end] ?? '' : '';
    const end = endRaw ? parseDate(endRaw, map.dateFormat) : undefined;
    const days = end && end >= date && end <= addDays(date, MAX_PERIOD_DAYS) ? eachDay(date, end) : [date];
    const symptoms = map.symptoms !== undefined
      ? (r[map.symptoms] ?? '')
          .split(/[|,;/]/)
          .map((s) => s.trim().toLowerCase())
          .map((s) => SYMPTOM_WORDS[s] ?? (SYMPTOM_IDS as readonly string[]).find((id) => id === s.replace(/ /g, '_')))
          .filter((s): s is SymptomId => !!s)
      : [];
    for (const d of days) {
      const log: DayLog = { ...(out.get(d) ?? { date: d }) };
      if (flow) log.flow = flow;
      if (symptoms.length && d === date) log.symptoms = [...new Set([...(log.symptoms ?? []), ...symptoms])];
      if (log.flow || log.symptoms) out.set(d, log);
    }
  });
  const logs = [...out.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  return { logs, errors, periodDays: logs.filter((l) => l.flow && l.flow !== 'spotting').length };
}

/** Merges imported days into existing ones; imported fields win, everything else is kept. */
export function mergeImported(existing: readonly DayLog[], imported: readonly DayLog[]): DayLog[] {
  const byDate = new Map(existing.map((l) => [l.date, l]));
  return imported.map((l) => ({ ...byDate.get(l.date), ...l, ...(l.symptoms && byDate.get(l.date)?.symptoms ? { symptoms: [...new Set([...byDate.get(l.date)!.symptoms!, ...l.symptoms])] } : {}) }));
}

/** Plain CSV export (unencrypted; the UI warns before offering it). Re-importable with the mapping. */
export function logsToCsv(logs: readonly DayLog[]): string {
  const head = ['date', 'flow', 'symptoms', 'mood', 'energy', 'sleepQuality', 'cervicalMucus', 'bbt', 'bbtTime', 'bbtDisturbed', 'lhTest', 'pregnancyTest', 'sex', 'medication', 'periodEnd', 'note'];
  const q = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = logs.map((l) =>
    [
      l.date, l.flow ?? '', (l.symptoms ?? []).join('|'), (l.mood ?? []).join('|'), l.energy ?? '', l.sleepQuality ?? '',
      l.cervicalMucus ?? '', l.bbt?.value ?? '', l.bbt?.time ?? '', l.bbt?.disturbed ? 'yes' : '', l.lhTest ?? '',
      l.pregnancyTest ?? '', (l.sex ?? []).map((s) => (s.protected ? 'protected' : 'unprotected')).join('|'),
      (l.medication ?? []).join('|'), l.periodEnd ? 'yes' : '', l.note ?? '',
    ].map((v) => q(String(v))).join(';'),
  );
  return '\uFEFF' + [head.join(';'), ...rows].join('\r\n');
}

const AYA_HEAD = 'date;flow;symptoms;mood;energy;sleepQuality;cervicalMucus;bbt;bbtTime;bbtDisturbed;lhTest;pregnancyTest;sex;medication;periodEnd;note';

/** True for a CSV written by logsToCsv: then every field is restored, no mapping needed. */
export function isAyaCsv(text: string): boolean {
  return text.replace(/^\uFEFF/, '').startsWith(AYA_HEAD);
}

const oneOf = <T extends string>(v: string, allowed: readonly T[]): T | undefined => (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
const list = (v: string) => (v ? v.split('|').filter(Boolean) : []);

export function ayaCsvToLogs(text: string): ImportResult {
  const rows = parseCsv(text).slice(1);
  const logs: DayLog[] = [];
  const errors: ImportResult['errors'] = [];
  rows.forEach((r, i) => {
    const [date = '', flow = '', symptoms = '', mood = '', energy = '', sleep = '', mucus = '', bbt = '', bbtTime = '', bbtDisturbed = '', lh = '', pregnancy = '', sex = '', medication = '', periodEnd = '', note = ''] = r;
    if (!isISODate(date)) return void errors.push({ row: i + 1, value: date });
    const log: DayLog = { date };
    const f = oneOf(flow, ['spotting', 'light', 'medium', 'heavy'] as const);
    if (f) log.flow = f;
    const s = list(symptoms).filter((x): x is SymptomId => (SYMPTOM_IDS as readonly string[]).includes(x));
    if (s.length) log.symptoms = s;
    const m = list(mood).filter((x) => ['calm', 'happy', 'energetic', 'irritable', 'sad', 'anxious', 'mood_swings', 'stressed'].includes(x));
    if (m.length) log.mood = m as NonNullable<DayLog['mood']>;
    const level = (v: string) => (/^[1-5]$/.test(v) ? (Number(v) as 1 | 2 | 3 | 4 | 5) : undefined);
    const e = level(energy);
    if (e) log.energy = e;
    const q = level(sleep);
    if (q) log.sleepQuality = q;
    const cm = oneOf(mucus, ['dry', 'sticky', 'creamy', 'watery', 'eggwhite'] as const);
    if (cm) log.cervicalMucus = cm;
    if (bbt && Number.isFinite(Number(bbt))) {
      log.bbt = { value: Number(bbt) };
      if (bbtTime) log.bbt.time = bbtTime;
      if (bbtDisturbed === 'yes') log.bbt.disturbed = true;
    }
    const l = oneOf(lh, ['negative', 'positive', 'peak'] as const);
    if (l) log.lhTest = l;
    const p = oneOf(pregnancy, ['negative', 'positive'] as const);
    if (p) log.pregnancyTest = p;
    const sx = list(sex).filter((x) => x === 'protected' || x === 'unprotected').map((x) => ({ protected: x === 'protected' }));
    if (sx.length) log.sex = sx;
    const meds = list(medication);
    if (meds.length) log.medication = meds;
    if (periodEnd === 'yes') log.periodEnd = true;
    if (note) log.note = note;
    logs.push(log);
  });
  return { logs, errors, periodDays: logs.filter((x) => x.flow && x.flow !== 'spotting').length };
}
