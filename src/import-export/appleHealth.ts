import { isISODate, type ISODate } from '../engine/dates.ts';
import type { DayLog, Flow, SymptomId } from '../engine/types.ts';

/**
 * Apple Health import. Health → profile → "Export All Health Data" writes export.zip with
 * apple_health_export/export.xml. Cycle apps such as Flo can write menstruation, temperature and
 * tests into Health, which makes this the one documented route out of them on the iPhone.
 *
 * The XML is read as a stream of text chunks: only <Record> elements of the cycle types are kept,
 * everything else (steps, heart rate …) is skipped without being held in memory.
 */

const FLOW: Record<string, Flow | null> = {
  HKCategoryValueMenstrualFlowUnspecified: 'medium',
  HKCategoryValueMenstrualFlowLight: 'light',
  HKCategoryValueMenstrualFlowMedium: 'medium',
  HKCategoryValueMenstrualFlowHeavy: 'heavy',
  HKCategoryValueMenstrualFlowNone: null,
};
const LH: Record<string, DayLog['lhTest']> = {
  HKCategoryValueOvulationTestResultNegative: 'negative',
  HKCategoryValueOvulationTestResultLuteinizingHormoneSurge: 'positive',
  HKCategoryValueOvulationTestResultPositive: 'positive',
};
const PREGNANCY: Record<string, DayLog['pregnancyTest']> = {
  HKCategoryValuePregnancyTestResultNegative: 'negative',
  HKCategoryValuePregnancyTestResultPositive: 'positive',
};
const MUCUS: Record<string, DayLog['cervicalMucus']> = {
  HKCategoryValueCervicalMucusQualityDry: 'dry',
  HKCategoryValueCervicalMucusQualitySticky: 'sticky',
  HKCategoryValueCervicalMucusQualityCreamy: 'creamy',
  HKCategoryValueCervicalMucusQualityWatery: 'watery',
  HKCategoryValueCervicalMucusQualityEggWhite: 'eggwhite',
};
const SYMPTOMS: Record<string, SymptomId> = {
  HKCategoryTypeIdentifierAbdominalCramps: 'cramps',
  HKCategoryTypeIdentifierHeadache: 'headache',
  HKCategoryTypeIdentifierBloating: 'bloating',
  HKCategoryTypeIdentifierBreastPain: 'breast_tenderness',
  HKCategoryTypeIdentifierAcne: 'acne',
  HKCategoryTypeIdentifierLowerBackPain: 'back_pain',
  HKCategoryTypeIdentifierNausea: 'nausea',
  HKCategoryTypeIdentifierFatigue: 'fatigue',
  HKCategoryTypeIdentifierDiarrhea: 'diarrhea',
  HKCategoryTypeIdentifierConstipation: 'constipation',
  HKCategoryTypeIdentifierSleepChanges: 'insomnia',
  HKCategoryTypeIdentifierDizziness: 'dizziness',
};

const TYPES = new Set([
  'HKCategoryTypeIdentifierMenstrualFlow',
  'HKCategoryTypeIdentifierIntermenstrualBleeding',
  'HKQuantityTypeIdentifierBasalBodyTemperature',
  'HKCategoryTypeIdentifierOvulationTestResult',
  'HKCategoryTypeIdentifierPregnancyTestResult',
  'HKCategoryTypeIdentifierCervicalMucusQuality',
  'HKCategoryTypeIdentifierSexualActivity',
  'HKCategoryTypeIdentifierMoodChanges',
  ...Object.keys(SYMPTOMS),
]);

export interface HealthImport {
  logs: DayLog[];
  /** Records per app that wrote them (e.g. "Flo", "Zyklusprotokoll"), for the preview. */
  sources: Record<string, number>;
  periodDays: number;
}

const attrs = (tag: string) => {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]!] = m[2]!;
  return out;
};

/** "2024-01-05 08:00:00 +0100" → the local calendar day as written. */
const dayOf = (stamp: string | undefined): ISODate | undefined => {
  const d = stamp?.slice(0, 10);
  return d && isISODate(d) ? d : undefined;
};

class Collector {
  private days = new Map<ISODate, DayLog>();
  sources: Record<string, number> = {};

  private day(date: ISODate): DayLog {
    let log = this.days.get(date);
    if (!log) this.days.set(date, (log = { date }));
    return log;
  }

  add(record: string): void {
    const open = record.slice(0, record.indexOf('>') + 1);
    const a = attrs(open);
    const type = a.type ?? '';
    if (!TYPES.has(type)) return;
    const date = dayOf(a.startDate);
    if (!date) return;
    const value = a.value ?? '';
    let used = true;
    if (type === 'HKCategoryTypeIdentifierMenstrualFlow') {
      const flow = FLOW[value];
      if (flow) this.day(date).flow = flow;
      else used = false;
    } else if (type === 'HKCategoryTypeIdentifierIntermenstrualBleeding') {
      const log = this.day(date);
      if (!log.flow) log.flow = 'spotting';
    } else if (type === 'HKQuantityTypeIdentifierBasalBodyTemperature') {
      let n = Number(value);
      if (a.unit === 'degF') n = ((n - 32) * 5) / 9;
      if (Number.isFinite(n) && n >= 34 && n <= 42) {
        const time = a.startDate?.slice(11, 16);
        this.day(date).bbt = { value: Math.round(n * 100) / 100, ...(time && /^\d\d:\d\d$/.test(time) ? { time } : {}) };
      } else used = false;
    } else if (type === 'HKCategoryTypeIdentifierOvulationTestResult') {
      const r = LH[value];
      if (r) this.day(date).lhTest = r;
      else used = false;
    } else if (type === 'HKCategoryTypeIdentifierPregnancyTestResult') {
      const r = PREGNANCY[value];
      if (r) this.day(date).pregnancyTest = r;
      else used = false;
    } else if (type === 'HKCategoryTypeIdentifierCervicalMucusQuality') {
      const r = MUCUS[value];
      if (r) this.day(date).cervicalMucus = r;
      else used = false;
    } else if (type === 'HKCategoryTypeIdentifierSexualActivity') {
      // Only with an explicit protection flag: "unknown" would otherwise count as unprotected.
      const flag = /key="HKSexualActivityProtectionUsed" value="(\d)"/.exec(record)?.[1];
      if (flag === undefined) used = false;
      else {
        const log = this.day(date);
        log.sex = [...(log.sex ?? []), { protected: flag === '1' }];
      }
    } else if (type === 'HKCategoryTypeIdentifierMoodChanges') {
      if (value.endsWith('NotPresent')) used = false;
      else {
        const log = this.day(date);
        log.mood = [...new Set([...(log.mood ?? []), 'mood_swings' as const])];
      }
    } else {
      const symptom = SYMPTOMS[type];
      if (!symptom || value.endsWith('NotPresent')) used = false;
      else {
        const log = this.day(date);
        log.symptoms = [...new Set([...(log.symptoms ?? []), symptom])];
      }
    }
    if (used) {
      const source = a.sourceName ? decodeEntities(a.sourceName) : '?';
      this.sources[source] = (this.sources[source] ?? 0) + 1;
    }
  }

  result(): HealthImport {
    const logs = [...this.days.values()].filter((l) => Object.keys(l).length > 1).sort((a, b) => (a.date < b.date ? -1 : 1));
    return { logs, sources: this.sources, periodDays: logs.filter((l) => l.flow && l.flow !== 'spotting').length };
  }
}

const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));

/** Reads export.xml from text chunks. Records may span chunk borders. */
export async function parseHealthExport(chunks: AsyncIterable<string> | Iterable<string>): Promise<HealthImport> {
  const c = new Collector();
  let buf = '';
  for await (const chunk of chunks) {
    buf += chunk;
    let start: number;
    while ((start = buf.indexOf('<Record ')) >= 0) {
      const gt = buf.indexOf('>', start);
      if (gt < 0) break;
      let end: number;
      if (buf[gt - 1] === '/') end = gt + 1;
      else {
        const close = buf.indexOf('</Record>', gt);
        if (close < 0) break;
        end = close + '</Record>'.length;
      }
      c.add(buf.slice(start, end));
      buf = buf.slice(end);
    }
    // Keep only a possible partial record; drop everything before it.
    const keep = buf.lastIndexOf('<');
    if (buf.indexOf('<Record ') < 0) buf = keep >= 0 ? buf.slice(keep) : '';
  }
  return c.result();
}

/** Async iteration over a ReadableStream (Safari lacks the built-in iterator on older versions). */
export async function* streamChunks(stream: ReadableStream<string>): AsyncGenerator<string> {
  const reader = stream.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      if (value) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
