import { useEffect, useMemo, useRef, useState } from 'react';
import type { ISODate } from '../../engine/dates.ts';
import { MOOD_IDS, SYMPTOM_IDS, type DayLog, type Flow, type MoodId, type SymptomId } from '../../engine/types.ts';
import { de, formatLongDate } from '../../i18n/de.ts';
import { Button } from './Button.tsx';
import { Chip } from './Chip.tsx';
import './DayLogSheet.css';

const FLOWS: (Flow | 'none')[] = ['none', 'spotting', 'light', 'medium', 'heavy'];
const t = de.log;

/** A patch may clear a field by setting it to undefined. */
type Patch = { [K in Exclude<keyof DayLog, 'date'>]?: DayLog[K] | undefined };

interface Props {
  date: ISODate;
  today: ISODate;
  log: DayLog | undefined;
  /** All logs, used to put frequently used symptoms first. */
  history: readonly DayLog[];
  onSave: (log: DayLog) => void;
  onClose: () => void;
}

/** Drops empty fields so an untouched day disappears from storage. */
function clean(log: Patch & { date: ISODate }): DayLog {
  const out: DayLog = { date: log.date };
  for (const [k, v] of Object.entries(log) as [keyof DayLog, unknown][]) {
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) continue;
    (out as unknown as Record<string, unknown>)[k] = v;
  }
  return out;
}

function toggle<T>(list: readonly T[] | undefined, item: T): T[] {
  const l = list ?? [];
  return l.includes(item) ? l.filter((x) => x !== item) : [...l, item];
}

/** Bottom sheet for one day. Every tap saves; the goal is an entry in under 10 seconds. */
export function DayLogSheet({ date, today, log, history, onSave, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // Local draft so rapid taps build on each other instead of on a stale prop.
  const [current, setCurrent] = useState<DayLog>(() => log ?? { date });
  const [note, setNote] = useState(current.note ?? '');

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    }
  }, []);

  const symptoms = useMemo(() => {
    const counts = new Map<SymptomId, number>();
    for (const l of history) for (const s of l.symptoms ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);
    return [...SYMPTOM_IDS].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
  }, [history]);

  const commit = (next: DayLog) => {
    setCurrent(next);
    onSave(next);
  };
  const update = (patch: Patch) => commit(clean({ ...current, ...patch, note }));
  const close = () => {
    if (note !== (current.note ?? '')) commit(clean({ ...current, note }));
    onClose();
  };

  const protectedSex = current.sex?.some((s) => s.protected === true) ?? false;
  const unprotectedSex = current.sex?.some((s) => s.protected !== true) ?? false;
  const setSex = (p: boolean, u: boolean) =>
    update({ sex: [...(p ? [{ protected: true }] : []), ...(u ? [{ protected: false }] : [])] });

  const scale = (field: 'energy' | 'sleepQuality', labels: readonly string[]) => (
    <div className="sheet-chips">
      {labels.map((label, i) => {
        const value = (i + 1) as 1 | 2 | 3 | 4 | 5;
        const selected = current[field] === value;
        return (
          <Chip key={label} selected={selected} onToggle={() => update({ [field]: selected ? undefined : value })}>
            {label}
          </Chip>
        );
      })}
    </div>
  );

  return (
    <dialog ref={ref} className="sheet" aria-labelledby="sheet-title" onCancel={(e) => (e.preventDefault(), close())}>
      <header className="sheet-head">
        <h2 id="sheet-title">{t.title(formatLongDate(date), date === today)}</h2>
        <Button variant="quiet" onClick={close}>
          {t.done}
        </Button>
      </header>

      <div className="sheet-body">
        <section aria-labelledby="log-flow">
          <h3 id="log-flow">{t.flow}</h3>
          <div className="sheet-chips">
            {FLOWS.map((f) => {
              const selected = f === 'none' ? !current.flow : current.flow === f;
              return (
                <Chip
                  key={f}
                  tone="period"
                  selected={selected}
                  onToggle={() => update(f === 'none' ? { flow: undefined, periodEnd: undefined } : { flow: f })}
                >
                  {t.flows[f]}
                </Chip>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="log-symptoms">
          <h3 id="log-symptoms">{t.symptoms}</h3>
          <div className="sheet-chips">
            {symptoms.map((s) => (
              <Chip
                key={s}
                selected={!!current.symptoms?.includes(s)}
                onToggle={() => update({ symptoms: toggle(current.symptoms, s) })}
              >
                {de.symptomLabels[s]}
              </Chip>
            ))}
          </div>
        </section>

        <section aria-labelledby="log-mood">
          <h3 id="log-mood">{t.mood}</h3>
          <div className="sheet-chips">
            {MOOD_IDS.map((m: MoodId) => (
              <Chip
                key={m}
                tone="luteal"
                selected={!!current.mood?.includes(m)}
                onToggle={() => update({ mood: toggle(current.mood, m) })}
              >
                {de.moodLabels[m]}
              </Chip>
            ))}
          </div>
        </section>

        <section aria-labelledby="log-energy">
          <h3 id="log-energy">{t.energy}</h3>
          {scale('energy', t.energyLevels)}
        </section>

        <section aria-labelledby="log-sleep">
          <h3 id="log-sleep">{t.sleep}</h3>
          {scale('sleepQuality', t.sleepLevels)}
        </section>

        <section aria-labelledby="log-sex">
          <h3 id="log-sex">{t.sex}</h3>
          <div className="sheet-chips">
            <Chip selected={protectedSex} onToggle={() => setSex(!protectedSex, unprotectedSex)}>
              {t.sexProtected}
            </Chip>
            <Chip selected={unprotectedSex} onToggle={() => setSex(protectedSex, !unprotectedSex)}>
              {t.sexUnprotected}
            </Chip>
          </div>
        </section>

        <section>
          <label className="sheet-note">
            <h3>{t.note}</h3>
            <textarea
              rows={3}
              value={note}
              placeholder={t.notePlaceholder}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => note !== (current.note ?? '') && commit(clean({ ...current, note }))}
            />
          </label>
        </section>
      </div>
    </dialog>
  );
}
