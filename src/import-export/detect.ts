import { parseHealthExport, streamChunks, type HealthImport } from './appleHealth.ts';
import { ayaCsvToLogs, csvToTable, guessMapping, isAyaCsv, jsonToTables, type ImportResult, type Mapping, type Table } from './tabular.ts';
import { listZip, zipEntryText } from './zip.ts';

export type Detected =
  /** Ready to import as is: aya's own CSV or an Apple Health export. */
  | { kind: 'logs'; source: 'aya-csv'; result: ImportResult }
  | { kind: 'logs'; source: 'health'; result: HealthImport }
  /** Needs a mapping check: CSV or JSON from another app (Flo, Clue, a spreadsheet …). */
  | { kind: 'table'; source: 'csv' | 'json'; tables: { path: string; table: Table }[]; mapping: Mapping | undefined }
  | { kind: 'unknown'; reason: 'empty' | 'zip-without-health' | 'unreadable' };

const textStream = (blob: Blob) => blob.stream().pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>);

/** Looks at a file the user picked and decides how to read it. Nothing leaves the device. */
export async function detectFile(file: Blob & { name?: string }): Promise<Detected> {
  const name = (file.name ?? '').toLowerCase();
  if (!file.size) return { kind: 'unknown', reason: 'empty' };

  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  if (isZip || name.endsWith('.zip')) {
    try {
      const entry = (await listZip(file)).find((e) => /(^|\/)(export|exportieren)\.xml$/i.test(e.name));
      if (!entry) return { kind: 'unknown', reason: 'zip-without-health' };
      return { kind: 'logs', source: 'health', result: await parseHealthExport(streamChunks(zipEntryText(file, entry))) };
    } catch {
      return { kind: 'unknown', reason: 'unreadable' };
    }
  }

  const start = (await file.slice(0, 512).text()).replace(/^\uFEFF/, '').trimStart();
  if (name.endsWith('.xml') || start.startsWith('<?xml') || start.startsWith('<HealthData')) {
    return { kind: 'logs', source: 'health', result: await parseHealthExport(streamChunks(textStream(file))) };
  }

  const text = await file.text();
  if (start.startsWith('{') || start.startsWith('[')) {
    try {
      const tables = jsonToTables(text).filter((t) => t.table.rows.length);
      if (!tables.length) return { kind: 'unknown', reason: 'unreadable' };
      return { kind: 'table', source: 'json', tables, mapping: guessMapping(tables[0]!.table) };
    } catch {
      return { kind: 'unknown', reason: 'unreadable' };
    }
  }
  if (isAyaCsv(text)) return { kind: 'logs', source: 'aya-csv', result: ayaCsvToLogs(text) };
  const table = csvToTable(text);
  if (!table.rows.length) return { kind: 'unknown', reason: 'unreadable' };
  return { kind: 'table', source: 'csv', tables: [{ path: '', table }], mapping: guessMapping(table) };
}
