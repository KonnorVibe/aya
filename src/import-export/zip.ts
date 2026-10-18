/**
 * Minimal ZIP reader for one entry (Apple Health's export.zip holds apple_health_export/export.xml).
 * Reads the central directory from the end of the file and inflates the entry as a stream with the
 * browser's DecompressionStream, so even a large export never sits in memory twice.
 */
export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  dataOffset: number;
}

async function bytes(blob: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await blob.slice(start, end).arrayBuffer());
}

export async function listZip(blob: Blob): Promise<ZipEntry[]> {
  const tailSize = Math.min(blob.size, 65_557);
  const tail = await bytes(blob, blob.size - tailSize, blob.size);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const count = tail.getUint16(eocd + 10, true);
  const cdSize = tail.getUint32(eocd + 12, true);
  const cdOffset = tail.getUint32(eocd + 16, true);
  const cd = await bytes(blob, cdOffset, cdOffset + cdSize);
  const entries: ZipEntry[] = [];
  let p = 0;
  for (let n = 0; n < count && p + 46 <= cd.byteLength; n++) {
    if (cd.getUint32(p, true) !== 0x02014b50) break;
    const method = cd.getUint16(p + 10, true);
    const compressedSize = cd.getUint32(p + 20, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    const localOffset = cd.getUint32(p + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
    const local = await bytes(blob, localOffset, localOffset + 30);
    const dataOffset = localOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
    entries.push({ name, method, compressedSize, dataOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** The entry's content as a text stream (stored or deflated). */
export function zipEntryText(blob: Blob, entry: ZipEntry): ReadableStream<string> {
  const raw = blob.slice(entry.dataOffset, entry.dataOffset + entry.compressedSize).stream();
  const plain = entry.method === 8 ? raw.pipeThrough(new DecompressionStream('deflate-raw') as unknown as TransformStream<Uint8Array, Uint8Array>) : raw;
  return plain.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>);
}
