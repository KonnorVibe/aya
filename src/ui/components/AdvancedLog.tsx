import { useState } from 'react';
import type { DayLog } from '../../engine/types.ts';
import { de } from '../../i18n/de.ts';
import { Chip } from './Chip.tsx';

const t = de.log;
const LH = ['negative', 'positive', 'peak'] as const;
const PREGNANCY = ['negative', 'positive'] as const;
const MUCUS = ['dry', 'sticky', 'creamy', 'watery', 'eggwhite'] as const;

type Patch = { [K in Exclude<keyof DayLog, 'date'>]?: DayLog[K] | undefined };

/** Accepts "36,55" and "36.55"; the plausible range keeps typos out of the 3-over-6 rule. */
export function parseTemperature(text: string): number | undefined | 'invalid' {
  const v = text.trim().replace(',', '.');
  if (!v) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 34 || n > 42) return 'invalid';
  return Math.round(n * 100) / 100;
}

export function parseMedication(text: string): string[] | undefined {
  const list = text.split(/[,;\n]/).map((m) => m.trim()).filter(Boolean);
  return list.length ? list : undefined;
}

const formatTemp = (v: number | undefined) => (v === undefined ? '' : v.toFixed(2).replace('.', ','));

/** Temperature, tests, cervical mucus and medication: the "advanced" part of a day log. */
export function AdvancedLog({ log, onChange }: { log: DayLog; onChange: (patch: Patch) => void }) {
  const [temp, setTemp] = useState(formatTemp(log.bbt?.value));
  const [tempError, setTempError] = useState(false);
  const [reason, setReason] = useState(log.bbt?.reason ?? '');
  const [meds, setMeds] = useState((log.medication ?? []).join(', '));

  const commitTemp = () => {
    const parsed = parseTemperature(temp);
    if (parsed === 'invalid') return setTempError(true);
    setTempError(false);
    if (parsed === undefined) return onChange({ bbt: undefined });
    if (parsed === log.bbt?.value) return;
    onChange({ bbt: { ...log.bbt, value: parsed } });
  };
  const bbt = log.bbt;
  type Bbt = NonNullable<DayLog['bbt']>;
  const setBbt = (patch: { time?: string | undefined; disturbed?: boolean | undefined; reason?: string | undefined }) => {
    if (!bbt) return;
    const merged = { ...bbt, ...patch };
    const next: Bbt = { value: merged.value };
    if (merged.time) next.time = merged.time;
    if (merged.disturbed) next.disturbed = true;
    if (merged.disturbed && merged.reason) next.reason = merged.reason;
    onChange({ bbt: next });
  };

  return (
    <>
      <section aria-labelledby="log-bbt">
        <h3 id="log-bbt">{t.bbt}</h3>
        <div className="sheet-row">
          <label className="sheet-field">
            <span>{t.bbtLabel}</span>
            <input
              inputMode="decimal"
              placeholder="36,50"
              value={temp}
              aria-invalid={tempError}
              onChange={(e) => setTemp(e.target.value)}
              onBlur={commitTemp}
            />
          </label>
          <label className="sheet-field">
            <span>{t.bbtTime}</span>
            <input type="time" value={bbt?.time ?? ''} disabled={!bbt} onChange={(e) => setBbt({ time: e.target.value || undefined })} />
          </label>
        </div>
        {tempError && <p className="sheet-error" role="alert">{t.bbtInvalid}</p>}
        <p className="sheet-hint">{t.bbtHint}</p>
        {bbt && (
          <div className="sheet-chips">
            <Chip selected={!!bbt.disturbed} onToggle={() => setBbt({ disturbed: !bbt.disturbed || undefined, ...(bbt.disturbed ? { reason: undefined } : {}) })}>
              {t.bbtDisturbed}
            </Chip>
          </div>
        )}
        {bbt?.disturbed && (
          <label className="sheet-field sheet-field-wide">
            <span>{t.bbtReason}</span>
            <input value={reason} placeholder={t.bbtReasonPlaceholder} onChange={(e) => setReason(e.target.value)} onBlur={() => setBbt({ reason: reason.trim() || undefined })} />
          </label>
        )}
      </section>

      <section aria-labelledby="log-lh">
        <h3 id="log-lh">{t.lh}</h3>
        <div className="sheet-chips">
          {LH.map((r) => (
            <Chip key={r} tone="fertile" selected={log.lhTest === r} onToggle={() => onChange({ lhTest: log.lhTest === r ? undefined : r })}>
              {t.lhResults[r]}
            </Chip>
          ))}
        </div>
      </section>

      <section aria-labelledby="log-mucus">
        <h3 id="log-mucus">{t.mucus}</h3>
        <div className="sheet-chips">
          {MUCUS.map((m) => (
            <Chip key={m} tone="fertile" selected={log.cervicalMucus === m} onToggle={() => onChange({ cervicalMucus: log.cervicalMucus === m ? undefined : m })}>
              {t.mucusTypes[m]}
            </Chip>
          ))}
        </div>
      </section>

      <section aria-labelledby="log-pregnancy">
        <h3 id="log-pregnancy">{t.pregnancy}</h3>
        <div className="sheet-chips">
          {PREGNANCY.map((r) => (
            <Chip key={r} selected={log.pregnancyTest === r} onToggle={() => onChange({ pregnancyTest: log.pregnancyTest === r ? undefined : r })}>
              {t.pregnancyResults[r]}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <label className="sheet-field sheet-field-wide">
          <h3>{t.medication}</h3>
          <input value={meds} placeholder={t.medicationPlaceholder} onChange={(e) => setMeds(e.target.value)} onBlur={() => onChange({ medication: parseMedication(meds) })} />
        </label>
      </section>
    </>
  );
}

/** True when the log already holds advanced data (then the section opens by itself). */
export const hasAdvanced = (log: DayLog) =>
  !!(log.bbt || log.lhTest || log.pregnancyTest || log.cervicalMucus || log.medication?.length);
