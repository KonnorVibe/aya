import { useMemo, useState } from 'react';
import { todayLocal } from '../../../engine/dates.ts';
import type { DayLog } from '../../../engine/types.ts';
import { de } from '../../../i18n/de.ts';
import { deliverFile } from '../../../import-export/deliver.ts';
import { detectFile, type Detected } from '../../../import-export/detect.ts';
import { DATE_FORMATS, logsToCsv, tableToLogs, type DateFormat, type Mapping } from '../../../import-export/tabular.ts';
import { useApp } from '../../../state/store.ts';
import { Button } from '../../components/Button.tsx';

const t = de.settings;
const PREVIEW_ROWS = 5;

type Stage =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'ready'; detected: Detected }
  | { kind: 'importing' }
  | { kind: 'done'; count: number }
  | { kind: 'error'; text: string };

function ColumnSelect({ label, value, header, optional, onChange }: {
  label: string;
  value: number | undefined;
  header: string[];
  optional?: boolean;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <label className="panel-field">
      <span>{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}>
        {optional && <option value="">{t.importNone}</option>}
        {header.map((h, i) => (
          <option key={`${h}-${i}`} value={i}>
            {h || `Spalte ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Mapping check for CSV and JSON: preview, columns, date format, live result count. */
function TableImport({ detected, onImport }: { detected: Extract<Detected, { kind: 'table' }>; onImport: (logs: DayLog[]) => void }) {
  const [listIndex, setListIndex] = useState(0);
  const table = detected.tables[listIndex]!.table;
  const [mapping, setMapping] = useState<Mapping | undefined>(detected.mapping);
  const result = useMemo(() => (mapping ? tableToLogs(table, mapping) : undefined), [table, mapping]);

  if (!mapping) return <p className="panel-status is-error">{t.importNoDates}</p>;
  type MappingPatch = { [K in keyof Mapping]?: Mapping[K] | undefined };
  const set = (patch: MappingPatch) => {
    const merged = { ...mapping, ...patch };
    const next: Mapping = { date: merged.date ?? 0, dateFormat: merged.dateFormat ?? 'iso' };
    if (merged.end !== undefined) next.end = merged.end;
    if (merged.flow !== undefined) next.flow = merged.flow;
    if (merged.symptoms !== undefined) next.symptoms = merged.symptoms;
    setMapping(next);
  };

  return (
    <>
      {detected.tables.length > 1 && (
        <label className="panel-field">
          <span>{t.importList}</span>
          <select
            value={listIndex}
            onChange={(e) => {
              const i = Number(e.target.value);
              setListIndex(i);
              setMapping(detected.tables[i]!.table.header.length ? { date: 0, dateFormat: 'iso' } : undefined);
            }}
          >
            {detected.tables.map((tb, i) => (
              <option key={tb.path} value={i}>
                {tb.path} ({tb.table.rows.length})
              </option>
            ))}
          </select>
        </label>
      )}
      <ColumnSelect label={t.importDate} value={mapping.date} header={table.header} onChange={(v) => set({ date: v ?? 0 })} />
      <label className="panel-field">
        <span>{t.importDateFormat}</span>
        <select value={mapping.dateFormat} onChange={(e) => set({ dateFormat: e.target.value as DateFormat })}>
          {DATE_FORMATS.map((f) => (
            <option key={f} value={f}>
              {t.importDateFormats[f]}
            </option>
          ))}
        </select>
      </label>
      <ColumnSelect label={t.importEnd} value={mapping.end} header={table.header} optional onChange={(v) => set({ end: v })} />
      <ColumnSelect label={t.importFlow} value={mapping.flow} header={table.header} optional onChange={(v) => set({ flow: v })} />
      {mapping.flow === undefined && <p className="row-hint">{t.importNoFlowHint}</p>}
      <ColumnSelect label={t.importSymptoms} value={mapping.symptoms} header={table.header} optional onChange={(v) => set({ symptoms: v })} />

      <div className="import-preview" role="region" aria-label={t.importPreview}>
        <table>
          <thead>
            <tr>
              {table.header.map((h, i) => (
                <th key={i} scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
              <tr key={i}>
                {table.header.map((_, j) => (
                  <td key={j}>{r[j]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result && (
        <>
          <p className="panel-status" role="status">{t.importFound(result.logs.length, result.periodDays)}</p>
          {result.errors.length > 0 && <p className="row-hint">{t.importErrors(result.errors.length)}</p>}
          <p className="row-hint">{t.importKeep}</p>
          <Button disabled={!result.logs.length} onClick={() => onImport(result.logs)}>
            {t.importStart}
          </Button>
        </>
      )}
    </>
  );
}

export function ImportPanel() {
  const importLogs = useApp((s) => s.importLogs);
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setStage({ kind: 'reading' });
    try {
      const detected = await detectFile(file);
      if (detected.kind === 'unknown') return setStage({ kind: 'error', text: t.importUnknown[detected.reason] });
      setStage({ kind: 'ready', detected });
    } catch {
      setStage({ kind: 'error', text: t.importUnknown.unreadable });
    }
  };
  const run = async (logs: DayLog[]) => {
    setStage({ kind: 'importing' });
    setStage({ kind: 'done', count: await importLogs(logs) });
  };

  return (
    <div className="panel">
      <p>{t.importIntro}</p>
      <label className="panel-field">
        <span>{t.importFile}</span>
        <input type="file" accept=".csv,.json,.xml,.zip,.txt,text/csv,application/json,application/zip,text/xml" onChange={(e) => void pick(e.target.files?.[0])} />
      </label>
      {(stage.kind === 'reading' || stage.kind === 'importing') && <p className="panel-status" role="status">{stage.kind === 'reading' ? t.importReading : t.working}</p>}
      {stage.kind === 'error' && <p className="panel-status is-error" role="status">{stage.text}</p>}
      {stage.kind === 'done' && <p className="panel-status" role="status">{t.importDone(stage.count)}</p>}
      {stage.kind === 'ready' && stage.detected.kind === 'logs' && (
        <>
          <p className="panel-status" role="status">{t.importFound(stage.detected.result.logs.length, stage.detected.result.periodDays)}</p>
          {stage.detected.source === 'health' && Object.keys(stage.detected.result.sources).length > 0 && (
            <>
              <p className="row-hint">{t.importSources}</p>
              <ul className="import-sources">
                {Object.entries(stage.detected.result.sources).map(([name, n]) => (
                  <li key={name}>
                    {name}: {t.importSourceCount(n)}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="row-hint">{t.importKeep}</p>
          <Button disabled={!stage.detected.result.logs.length} onClick={() => stage.detected.kind === 'logs' && void run(stage.detected.result.logs)}>
            {t.importStart}
          </Button>
        </>
      )}
      {stage.kind === 'ready' && stage.detected.kind === 'table' && <TableImport detected={stage.detected} onImport={(l) => void run(l)} />}
    </div>
  );
}

export function CsvExportPanel() {
  const logs = useApp((s) => s.logs);
  const [done, setDone] = useState(false);
  const save = async () => {
    await deliverFile(logsToCsv(logs), `aya-export-${todayLocal()}.csv`, 'text/csv');
    setDone(true);
  };
  return (
    <div className="panel">
      <p>{t.csvIntro}</p>
      <Button variant="secondary" onClick={() => void save()}>
        {t.csvCreate}
      </Button>
      {done && <p className="panel-status" role="status">{t.csvDone}</p>}
    </div>
  );
}
