# Selbst-Audit aya 1.0 (App-Prompt §11.5), Stand 2026-10-18

Geprüft: 146 Unit- und UI-Tests grün, ESLint ohne Befund, TypeScript strict, Build, `npm run privacy-check` bestanden, E2E-Test (`e2e/smoke.spec.ts`) grün in Chromium mit Mobilprofil. In GitHub Actions läuft derselbe Test in WebKit mit iPhone-Profil, die Veröffentlichung hängt davon ab. Oberfläche hell und dunkel per Screenshot geprüft.

## §2 Nicht verhandelbare Prinzipien

| Punkt | Ergebnis |
|---|---|
| 1. Zero Network, CSP | erfüllt. CSP mit `connect-src 'none'` per Meta-Tag, keine CDNs, Webfonts, Analyse. Privacy-Check prüft Quellcode und Build, der E2E-Test prüft, dass keine Anfrage an fremde Adressen geht. Einzige Ausnahme: Der Service Worker sucht beim Öffnen auf der eigenen Adresse nach Updates. |
| 2. Verschlüsselung im Ruhezustand | erfüllt. Jeder Datensatz einzeln mit AES-GCM, Datums-IDs als HMAC, Service Worker cacht nur die App-Shell. Tests: `repository.test.ts` und E2E. |
| 3. Export, Import, Löschen in zwei Taps | erfüllt ab dem Einstellungs-Tab. Löschen verlangt zusätzlich „LÖSCHEN“. |
| 4. Ehrlichkeit | erfüllt. Jede Vorhersage zeigt Spanne und Sicherheit. Hinweis „kein Verhütungsmittel, kein Medizinprodukt“ im Onboarding, in den Einstellungen und in der Druckansicht. |
| 5. Kein Logging sensibler Daten | erfüllt. Kein `console`-Aufruf im App-Code. |

## §4 Sicherheitsarchitektur

| Punkt | Ergebnis |
|---|---|
| Zufälliger Data Key AES-GCM 256 | erfüllt (64-Byte-Geheimnis: AES-GCM plus HMAC) |
| Gewrappt mit Passphrase und Wiederherstellungscode, PBKDF2-SHA-256, 600.000 Runden, 16-Byte-Salt | erfüllt im Passphrase-Modus. **Bewusste Abweichung:** Standard ist der Gerätemodus mit nicht exportierbarem Geräteschlüssel, die Passphrase ist im Onboarding wählbar (Entscheidung vom 18.10., siehe PLAN.md). |
| Wiederherstellungscode 128 Bit, Base32 in 4er-Gruppen, einmal angezeigt | erfüllt (Onboarding und Einstellungen, abgesichert durch UI- und E2E-Test) |
| Frischer 12-Byte-IV pro Datensatz | erfüllt (Test) |
| Data Key nur im Speicher, nicht exportierbar | erfüllt (Test) |
| Auto-Lock 5 min und nach 60 s im Hintergrund | erfüllt, Zeit wählbar (1, 5, 15 min). Im Passphrase-Modus immer aktiv und mit Verwerfen der Schlüssel, im Gerätemodus mit PIN. |
| PIN oder Passphrase, Hinweis zur PIN | **Abweichung:** PIN nur als App-Sperre im Gerätemodus. Im Passphrase-Modus sind nur Passphrasen erlaubt (4 Wörter oder 16 Zeichen), weil eine 6-stellige PIN offline schnell zu erraten wäre. |
| Exponentielle Wartezeit ab 5 Fehlversuchen | erfüllt (Test) |
| PIN/Passphrase ändern ohne Neuverschlüsselung | erfüllt, ebenso Wechsel der Schutzart (Test: Datensätze bleiben byte-gleich) |
| `navigator.storage.persist()` | erfüllt, nach Onboarding und Entsperren |
| Sichtschutz | erfüllt, abschaltbar (Standard aus) |
| Panik-Löschen mit „LÖSCHEN“ | erfüllt |
| Bedrohungsmodell in der README | erfüllt, für beide Schutzarten |

## §6 Vorhersage-Engine

| Punkt | Ergebnis |
|---|---|
| Reine Funktionen in `src/engine/`, JSDoc mit Begründung | erfüllt |
| A. Zyklen ableiten, Ausreißer, vergessene Periode mit Rückfrage | erfüllt, Rückfrage auf Heute und im Kalender |
| A4. Hormonelle Verhütung | erfüllt für die laufende Anzeige (kein Eisprung, keine Temperaturauswertung). Wie in beiden Vorläufern speichert aya nicht, welche früheren Zyklen in diesem Modus lagen. |
| B. 12 Zyklen, Rezenz-Gewichtung, gewichteter Median, Bayes-Schrumpfung | erfüllt. **Abweichung:** k sinkt beim Mittelwert bis zum 6. Zyklus auf 0 (Test: stabile 32 Tage werden als 32 erkannt). |
| C. MAD × 1,4826, 80-%-Intervall, Konfidenzstufen, FIGO-Hinweis | erfüllt |
| D. Eisprung aus Lutealphase, fruchtbares Fenster, BBT 3-über-6, LH, sichtbare Verfeinerung | erfüllt |
| E. Verspätung, Schwangerschaftstest-Hinweis, Modi, Gesundheitshinweise | erfüllt. Im Modus Kinderwunsch stehen Temperatur und Tests im Tagesprotokoll oben. |
| F. Symptom-Muster | erfüllt |
| G. Backtest mit MAE und Trefferquote, angezeigt | erfüllt in den Einblicken |
| §6.3 Tests | erfüllt, plus Benchmark auf simulierten Daten (Trefferquote 75 bis 90 %) |

## §8 Import und Export

| Punkt | Ergebnis |
|---|---|
| Schnellnachtrag im Kalender | erfüllt |
| CSV-Import mit Vorschau, Zuordnung, Validierung, drei Datumsformate, `;` und `,` | erfüllt, zusätzlich Tab und Unix-Zeitstempel |
| JSON-Import mit Zuordnungsmaske, kein fester Flo-Parser | erfüllt, mit automatischer Erkennung verschachtelter Listen |
| Zusätzlich | Apple-Health-Export (`export.zip`, `export.xml`) |
| Verschlüsseltes Backup mit Erinnerung nach 30 Tagen | erfüllt, mit eigenem Backup-Passwort |
| Klartext-CSV-Export mit Warnung | erfüllt, verlustfrei wieder importierbar |

## §12 Definition of Done

| Punkt | Ergebnis |
|---|---|
| Tests grün, Build, Privacy-Check | erfüllt |
| Offline im Flugmodus | erfüllt im E2E-Test (Browser offline), auf dem iPhone noch zu prüfen |
| 6 × 28 Tage: korrekt, enge Spanne, hohe Sicherheit | erfüllt (Test) |
| BBT-Anstieg verfeinert sichtbar | erfüllt (Test und Einblicke) |
| Sperren, Entsperren, Ändern, Wiederherstellung, Backup | erfüllt (Tests, E2E) |
| Kein Klartext in IndexedDB | erfüllt (Test, E2E) |
| Hinweis im Onboarding und in den Einstellungen | erfüllt |

## Offen

- Test auf einem echten iPhone: Installation vom Home-Bildschirm, Flugmodus, Sichtschutz im App-Umschalter, Geräteschlüssel nach Neustart und App-Update.
- Import mit einer echten Flo-Datei, sobald sie vorliegt.
