# PLAN: aya 1.0

aya 1.0 führt die beiden Vorläufer `KonnorVibe/test-a` (Code-Basis) und `KonnorVibe/vergleichskillweb` (Funktionsumfang, Marke, Doku) zusammen. Grundlage: der App-Prompt in [`docs/zyklus-app-prompt.md`](docs/zyklus-app-prompt.md) (dort noch „Luna“).

## Entscheidungen (18.10.2026)

| Punkt | Entscheidung |
|---|---|
| Sicherheit | Hybrid. Ein 64-Byte-Geheimnis (32 Byte AES-GCM, 32 Byte HMAC). Gerätemodus: Geheimnis mit nicht exportierbarem Geräteschlüssel gehüllt, PIN optional als App-Sperre. Passphrase-Modus: Geheimnis mit Passphrase und Wiederherstellungscode gehüllt (PBKDF2-SHA-256, 600.000 Runden). Wahl im Onboarding, später umschaltbar |
| Umfang | alles aus beiden Projekten |
| Optik | Sternatlas-Ring aus test-a, Logo und Palette aus vergleichskillweb |
| Altdaten | keine, keine Migration |
| Release | Checks, E2E, eigener iPhone-Test, Datenimport getestet |
| Import | CSV und JSON mit Zuordnungsmaske, Flo-Erkennung (Format nicht öffentlich dokumentiert), Apple-Health-`export.xml` |
| Erweitert | Temperatur, LH, Schwangerschaftstest, Ausfluss, Medikamente. Im Modus Kinderwunsch oben, sonst eingeklappt |
| Impressum | augenzwinkernde Platzhalter, keine echten Daten |

## Architektur

```
src/
  engine/        reine Funktionen: Zyklen, Vorhersage, Eisprung, Muster, Gesundheit, Backtest (+ Tests)
  crypto/        Geheimnis, Hüllen, AES-GCM, PIN, Backup, Encoding (+ Tests)
  storage/       IndexedDB-Repository, nur {id: HMAC, iv, ciphertext} (+ Tests)
  state/         Zustand-Store, Sperre, Onboarding (+ Tests)
  import-export/ Backup (.aya), CSV, JSON, Apple Health, ICS, Teilen (+ Tests)
  ui/            screens/, components/, theme/, hooks/
  i18n/de.ts     alle Texte
scripts/         privacy-check, make-icons
e2e/             Playwright-Smoke-Test (WebKit)
```

## Phasen

1. Setup aus test-a
2. Engine zusammenführen
3. Hybrid-Krypto und Speicher
4. Onboarding und Sperre
5. Marke
6. Tagesprotokoll, Heute, Kalender
7. Einblicke
8. Daten-Import und -Export
9. Texte und Doku
10. Abschluss: E2E, Selbst-Audit, Deploy

Jede Phase endet mit grünen Checks (`npm test`, `npm run lint`, `npm run build`, `npm run privacy-check`) und einem Commit.
