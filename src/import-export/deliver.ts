/**
 * Hands a locally generated file to the user. On iOS the share sheet offers "In Dateien sichern"
 * and AirDrop; elsewhere it falls back to a plain download. Nothing leaves the device unasked.
 */
export async function deliverFile(text: string, filename: string, type: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([text], filename, { type });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

export function readFileText(file: File): Promise<string> {
  return file.text();
}
