# aya

Ein privates Zyklustagebuch für das iPhone. aya läuft als Web-App vom Home-Bildschirm, sagt die nächste Periode, den Eisprung und das fruchtbare Fenster voraus und speichert alles verschlüsselt auf dem Gerät. Es gibt kein Konto, keinen Server und keine Analyse.

**aya ist kein Verhütungsmittel und kein Medizinprodukt.**

Der Name kommt aus dem Japanischen: 綾 bedeutet ein gewebtes Muster. aya 1.0 führt die beiden Vorläufer `test-a` (Code-Basis, Optik) und `vergleichskillweb` (Funktionsumfang, Marke, Doku) zusammen, siehe [PLAN.md](PLAN.md).

## Installation und lokales Starten

Voraussetzung: Node.js 24 (mindestens 22.22 für die Tests).

```bash
npm install
npm run dev
```

Die App läuft dann unter `http://localhost:5173`.

| Befehl | Zweck |
|---|---|
| `npm test` | Unit- und UI-Tests (Vorhersage, Verschlüsselung, Speicher, Import, Oberfläche) |
| `npm run lint` | ESLint |
| `npm run build` | Produktions-Build nach `dist/` |
| `npm run preview` | Produktions-Build lokal ansehen |
| `npm run privacy-check` | Bricht ab, wenn Quellcode oder Build Netzwerk-APIs oder externe Adressen enthalten |
| `npm run test:e2e` | End-to-End-Test in WebKit (einmalig vorher `npx playwright install webkit`) |
| `node scripts/make-icons.ts` | App-Icons aus dem Geflecht-Motiv neu rendern |

## Deployment auf GitHub Pages

Der Workflow `.github/workflows/pages.yml` baut bei jedem Push auf `main`: Lint, Tests, Build, Privacy-Check, dann Veröffentlichung. Einmalig in den Repository-Einstellungen unter **Pages** als Quelle **GitHub Actions** wählen. Der Build nutzt relative Pfade (`base: './'`) und läuft unter `https://<name>.github.io/aya/`. Die Seite trägt `noindex`.

## Auf dem iPhone installieren

1. Die Adresse in **Safari** öffnen.
2. Auf **Teilen** tippen, dann auf **Zum Home-Bildschirm**.
3. aya ab jetzt immer über das Icon öffnen. Nur so bleibt der Speicher dauerhaft, und die App funktioniert auch im Flugmodus.

## Bedrohungsmodell

aya schützt in jedem Fall:

- vor anderen Webseiten und Apps (Daten liegen verschlüsselt in der IndexedDB der eigenen Herkunft),
- vor Datenabfluss an Dritte (keine Netzwerkanfragen nach dem Laden, Content Security Policy mit `connect-src 'none'`, keine CDNs, keine Webfonts, keine Analyse),
- vor Blicken im App-Umschalter (optionaler Sichtschutz).

Beim Einrichten wählt die Nutzerin, wie stark der Schutz bei entsperrtem iPhone sein soll:

| | Mit diesem iPhone (Standard) | Mit einer Passphrase |
|---|---|---|
| Öffnen | ohne Eingabe, optional PIN | Passphrase oder Wiederherstellungscode |
| Schützt vor | neugierigen Blicken (mit PIN) | jedem ohne Passphrase, auch mit entsperrtem Gerät |
| Schützt nicht vor | jemandem mit vollem Zugriff auf das entsperrte Gerät und technischem Wissen | einer erratbaren Passphrase |
| Wenn etwas verloren geht | Gerät weg: nur ein Backup hilft | Passphrase und Code vergessen: Daten weg |

aya ersetzt nicht die Gerätesperre des iPhones.

### Umsetzung

- Beim Einrichten entsteht ein zufälliges 64-Byte-Geheimnis: 32 Byte AES-GCM-256-Datenschlüssel, 32 Byte HMAC-SHA-256-Schlüssel für die Datensatz-IDs.
- **Gerätemodus:** Das Geheimnis wird mit einem nicht exportierbaren AES-GCM-Geräteschlüssel verschlüsselt, den der Browser erzeugt und als `CryptoKey` in IndexedDB ablegt. Kein Skript kann seine Bytes lesen. Die PIN ist eine Sperre der Oberfläche (PBKDF2-Hash, 100.000 Runden), keine Verschlüsselungsstufe.
- **Passphrase-Modus:** Das Geheimnis wird zweimal verschlüsselt: mit einem Schlüssel aus der Passphrase und einem aus dem Wiederherstellungscode (128 Bit, Base32), beide per PBKDF2-SHA-256 mit 600.000 Runden und eigenem Salt. Erlaubt sind nur Passphrasen mit mindestens 4 Wörtern oder 16 Zeichen, keine 6-stellige PIN, denn eine PIN wäre offline schnell zu erraten. Beim Sperren verwirft aya Schlüssel und Klartext.
- Jeder Tageseintrag und die Einstellungen werden einzeln mit AES-GCM und frischem 12-Byte-IV verschlüsselt, die Datensatz-ID ist als zusätzliche authentifizierte Daten gebunden. Die IDs sind HMACs des Datums, deshalb ist nicht einmal sichtbar, an welchen Tagen es Einträge gibt.
- Nach dem Entsperren liegen die Schlüssel nur als nicht exportierbare `CryptoKey`-Objekte im Speicher, die Rohbytes werden überschrieben.
- Schutzart wechseln, Passphrase ändern und einen neuen Wiederherstellungscode erzeugen verschlüsselt nur das Geheimnis neu, nie die Einträge. Vor einem Wechsel der Schutzart verlangt aya ein Backup der letzten 24 Stunden.
- Ab dem 5. Fehlversuch pausiert das Entsperren mit steigender Wartezeit (30 s, 1 min, 2 min … höchstens 1 h). Das ist eine Komfortbremse, keine Sicherheitsgrenze.
- Backups (`.aya`) sind mit einem eigenen Backup-Passwort verschlüsselt (PBKDF2-SHA-256, 600.000 Runden), unabhängig von der Schutzart. So hängt eine geteilte Datei nie an einer kurzen PIN.
- Der Service Worker speichert nur die App-Dateien, nie Nutzerdaten. „Alle Daten löschen“ entfernt die gesamte Datenbank samt Schlüsseln.

Tests prüfen, dass weder Gesundheitsdaten noch Datumsangaben im Klartext in IndexedDB stehen (`src/storage/repository.test.ts`, zusätzlich im E2E-Test).

## Methodik der Vorhersage

Die Logik liegt als reine Funktionen in `src/engine/` und ist vollständig getestet.

- **Zyklen** werden immer aus den Tageseinträgen abgeleitet. Eine Periode beginnt am ersten Tag mit mindestens leichter Blutung. Schmierblutung allein beginnt keinen Zyklus. Blutungsphasen mit weniger als 3 blutungsfreien Tagen dazwischen zählen als eine Periode.
- **Bereinigung:** Zyklen unter 15 oder über 90 Tagen sind Ausreißer. Ein Zyklus, der länger als das 1,6-Fache des persönlichen Medians und länger als 45 Tage ist, gilt als mögliche vergessene Periode (Li et al., JAMIA 2022). aya fragt auf „Heute“ und im Kalender nach, ob sie nachgetragen oder einbezogen werden soll.
- **Nächste Periode:** gewichteter Median der letzten bis zu 12 Zyklen, neuere Zyklen zählen stärker (Halbwertszeit 6 Zyklen). Beim Kaltstart wird zur Angabe aus dem Onboarding hin geschrumpft, sonst zu 29 Tagen: `(n · persönlich + k · Prior) / (n + k)`. Abweichend vom Prompt sinkt k beim Mittelwert von 3 auf 0 bis zum 6. Zyklus, sonst würde ein stabiler 32-Tage-Zyklus dauerhaft auf 31 Tage geschätzt. Die Streuung behält k = 3.
- **Unsicherheit:** robuste Streuung (MAD × 1,4826) mit einer Prior-Streuung von 3 Tagen. Angezeigt werden ein 80-%-Intervall und eine Konfidenzstufe. Schwanken die Zyklen stärker als die FIGO-Grenze (7 bis 9 Tage je nach Alter), wird die Spanne breiter.
- **Eisprung** = vorhergesagter Periodenbeginn minus persönliche Lutealphase (bestätigte Lutealphasen, sonst 12,4 Tage nach Bull et al. 2019). Nie pauschal Tag 14.
- **Fruchtbares Fenster:** die 5 Tage vor dem Eisprung und der Eisprungtag (Wilcox et al., NEJM 1995), erweitert um die Unsicherheit, Höhepunkt die 2 Tage davor und der Eisprungtag.
- **Bestätigung:** Basaltemperatur nach der 3-über-6-Regel (gestörte Messungen zählen nicht) oder ein positiver LH-Test. Dann wird die nächste Periode aus Eisprung plus Lutealphase berechnet, die Spanne wird enger.
- **Muster:** Symptome pro Zyklusphase, gezeigt erst ab 3 Zyklen, in mindestens der Hälfte der Zyklen und bei mindestens 1,5-facher Häufigkeit.
- **Genauigkeit (Backtest):** Für jeden Zyklus ab dem dritten wird die Vorhersage nur aus den Zyklen davor berechnet und mit dem echten Beginn verglichen. Ein Benchmark-Test hält die Trefferquote der 80-%-Spanne auf simulierten Daten zwischen 75 und 90 %.
- **Gesundheitshinweise** (FIGO 2018) bei meist kurzen (< 24 Tage) oder langen (> 38 Tage) Zyklen, wiederholt langen Perioden, starker Schwankung oder über 90 Tagen ohne Periode. Immer mit dem Hinweis auf die Ärztin oder den Arzt, nie als Diagnose.

### Quellen

- Bull JR et al. Real-world menstrual cycle characteristics of more than 600,000 menstrual cycles. npj Digital Medicine 2019;2:83.
- Wilcox AJ, Weinberg CR, Baird DD. Timing of sexual intercourse in relation to ovulation. N Engl J Med 1995;333:1517–21.
- Munro MG et al. The two FIGO systems for normal and abnormal uterine bleeding symptoms … 2018 revisions. Int J Gynaecol Obstet 2018.
- Li K et al. A predictive model for next cycle start date that accounts for adherence in menstrual self-tracking. JAMIA 2022.

## Datenimport

Unter **Einstellungen → Daten importieren**, alles wird nur auf dem Gerät gelesen. Bestehende Einträge bleiben erhalten, am selben Tag gewinnen die importierten Angaben.

- **Apple Health** (`export.zip` oder `export.xml` aus Health → Profil → „Alle Gesundheitsdaten exportieren“): Periode, Zwischenblutung, Basaltemperatur, LH-Test, Schwangerschaftstest, Zervixschleim, Symptome. Die Datei wird als Datenstrom gelesen, auch große Exporte passen in den Speicher. Flo und andere Apps können ihre Daten nach Health schreiben.
- **CSV und JSON** (zum Beispiel aus Flo oder einer eigenen Tabelle): aya erkennt Spalten und verschachtelte Listen, zeigt eine Vorschau und lässt Datum, Format, Periodenende, Stärke und Symptome zuordnen. Flo liefert den Export nur über den Support-Chat, das JSON-Format ist nicht öffentlich dokumentiert. Deshalb gibt es keinen festen Flo-Parser.
- **aya-CSV** aus dem eigenen Export wird ohne Zuordnung und ohne Verlust zurückgelesen.

Testvorlagen liegen in [`docs/import-vorlagen/`](docs/import-vorlagen/).

## Bekannte Grenzen

- **Keine Erinnerungen von selbst.** iOS-Web-Apps können ohne Server keine lokalen Benachrichtigungen planen. aya exportiert die vorhergesagten Perioden als Kalenderdatei (`.ics`) mit frei wählbarem Titel. Die Termine aktualisieren sich nicht von selbst.
- **Speicher:** iOS kann Daten von Web-Apps löschen, wenn der Speicher knapp wird. aya fragt dauerhaften Speicher an und erinnert an ein Backup, wenn das letzte älter als 30 Tage ist.
- **Gerätemodus:** Ob iOS den als `CryptoKey` gespeicherten Geräteschlüssel über App-Updates und Neustarts zuverlässig behält, ist auf einem echten iPhone zu prüfen. Ein Backup sichert in jedem Fall ab.
- **Updates:** Der Service Worker prüft beim Öffnen, ob es eine neue App-Version gibt. Das ist eine Anfrage an die eigene Adresse der App, nie an Dritte.
- Die Vorhersage ist statistisch, nicht medizinisch. Sie ersetzt keine ärztliche Beratung.
