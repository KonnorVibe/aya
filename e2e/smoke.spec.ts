import { expect, test, type Page } from '@playwright/test';

// Test-only secrets for a throwaway local profile.
const BACKUP_PASSWORD = 'nur-fuer-den-test';
const PASSPHRASE = 'ein langer satz nur fuer den e2e test';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Everything IndexedDB holds, as text: store keys, structure and byte fields decoded as Latin-1. */
async function dumpIndexedDb(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open('aya');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    let out = '';
    for (const name of Array.from(db.objectStoreNames)) {
      const all: unknown[] = await new Promise((res) => {
        const r = db.transaction(name).objectStore(name).getAll();
        r.onsuccess = () => res(r.result);
      });
      const keys: unknown[] = await new Promise((res) => {
        const r = db.transaction(name).objectStore(name).getAllKeys();
        r.onsuccess = () => res(r.result);
      });
      out += JSON.stringify(keys);
      const bytes = (x: unknown) => (x instanceof ArrayBuffer ? new Uint8Array(x) : x instanceof Uint8Array ? x : undefined);
      for (const v of all) out += JSON.stringify(v, (_k, x) => (bytes(x) ? Array.from(bytes(x)!, (b) => String.fromCharCode(b)).join('') : x));
    }
    db.close();
    return out;
  });
}

test('onboarding, logging, encryption at rest, passphrase switch, lock, offline and import', async ({ page, context }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173')) external.push(r.url());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Deine Daten bleiben bei dir' })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByRole('heading', { name: 'Wie soll aya deine Daten schützen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByLabel('Erster Tag').fill(daysAgo(10));
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText('aya ist kein Verhütungsmittel und kein Medizinprodukt.')).toBeVisible();
  await page.getByRole('button', { name: 'Los geht’s' }).click();

  await expect(page.getByRole('img', { name: /Zyklustag 11/ })).toBeVisible();

  await page.getByRole('button', { name: 'Heute eintragen' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Kopfschmerzen' }).click();
  await sheet.getByLabel('Notiz').fill('Geheime Notiz');
  await sheet.getByRole('button', { name: 'Fertig' }).click();

  // Nothing readable in IndexedDB: no note, no symptom id, no date.
  let dump = await dumpIndexedDb(page);
  for (const needle of ['Geheime Notiz', 'headache', daysAgo(10), daysAgo(0)]) expect(dump).not.toContain(needle);

  // Backup first, then switch to passphrase protection.
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Backup erstellen' }).click();
  await page.getByLabel('Passwort', { exact: true }).fill(BACKUP_PASSWORD);
  await page.getByLabel('Passwort wiederholen').fill(BACKUP_PASSWORD);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Backup speichern' }).click();
  expect((await download).suggestedFilename()).toMatch(/^aya-backup-.*\.aya$/);

  await page.getByLabel(/Mit einer Passphrase/).check();
  await page.getByLabel('Neue Passphrase').fill(PASSPHRASE);
  await page.getByLabel('Noch einmal eingeben').fill(PASSPHRASE);
  await page.getByRole('button', { name: 'Bestätigen' }).click();
  await expect(page.locator('.recovery-code')).toHaveText(/^([A-Z2-7]{4} ){6}[A-Z2-7]{2}$/, { timeout: 30_000 });
  await page.getByLabel('Ich habe den Code notiert.').check();
  await page.getByRole('button', { name: 'Fertig' }).click();
  dump = await dumpIndexedDb(page);
  expect(dump).not.toContain(PASSPHRASE);

  // A reload locks; the passphrase unlocks and the data is back.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'aya ist gesperrt' })).toBeVisible();
  await page.getByLabel('Passphrase oder Wiederherstellungscode').fill(PASSPHRASE);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('img', { name: /Zyklustag 11/ })).toBeVisible({ timeout: 30_000 });

  // Works offline once the service worker has cached the shell.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'aya ist gesperrt' })).toBeVisible();
  await page.getByLabel('Passphrase oder Wiederherstellungscode').fill(PASSPHRASE);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('img', { name: /Zyklustag 11/ })).toBeVisible({ timeout: 30_000 });

  // Offline import of an Apple Health export.
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Daten importieren' }).click();
  await page.getByLabel('Datei').setInputFiles('docs/import-vorlagen/apple-health-export.xml');
  await expect(page.getByText(/Tage gefunden, davon 45 mit Periode/)).toBeVisible();
  await expect(page.getByText('Flo: 68 Einträge')).toBeVisible();
  await page.getByRole('button', { name: 'Importieren', exact: true }).click();
  await expect(page.getByText(/^Importiert: \d+ Tage\.$/)).toBeVisible();
  await context.setOffline(false);

  expect(external).toEqual([]);
});
