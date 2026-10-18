# Prompt für Claude Code: Private Zyklus-App („Luna“)

> Diesen gesamten Text in Claude Code einfügen. Am besten in einem leeren Ordner starten.

---

## 1. Rolle und Ziel

Du bist ein erfahrenes Team aus Senior Frontend Engineer, Security Engineer und Data Scientist mit Erfahrung in reproduktiver Gesundheit. Baue eine vollständige, produktionsreife Zyklus-Tracking-App als **installierbare PWA** (Progressive Web App) für eine einzelne Nutzerin auf dem iPhone.

Die App orientiert sich im Funktionsumfang und in der Bedienqualität an **Flo**, hat aber einen entscheidenden Unterschied: **Alle Daten bleiben verschlüsselt auf dem Gerät. Es gibt keinen Server, keinen Account, keine Cloud, kein Tracking.**

Das Kernprodukt muss wirklich funktionieren: Die Vorhersagen sollen auf wissenschaftlich fundierten Methoden beruhen, ihre Unsicherheit ehrlich zeigen und mit jedem geloggten Zyklus besser werden. Keine Attrappe, keine Platzhalter, keine TODOs im ausgelieferten Code.

Sprache der Oberfläche: **Deutsch**. Code, Kommentare und Bezeichner: Englisch.

---

## 2. Nicht verhandelbare Prinzipien

1. **Zero Network:** Nach dem Laden der App erfolgen keinerlei Netzwerkanfragen. Keine Analytics, keine Fehler-Tracker, keine CDNs, keine Google Fonts, keine externen Bilder. Alle Abhängigkeiten werden gebündelt. Setze eine strikte Content Security Policy per Meta-Tag: `default-src 'self'; connect-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`.
2. **Verschlüsselung im Ruhezustand:** Kein Gesundheitsdatum liegt jemals im Klartext in IndexedDB, localStorage oder im Service-Worker-Cache.
3. **Datenhoheit:** Export, Import und vollständiges Löschen jederzeit mit zwei Taps möglich.
4. **Ehrlichkeit:** Jede Vorhersage zeigt eine Spanne und einen Konfidenzhinweis. Die App ist kein Verhütungsmittel und kein Medizinprodukt. Das steht beim Onboarding und in den Einstellungen.
5. **Kein Logging sensibler Daten** in die Konsole, auch nicht im Dev-Modus.

---

## 3. Tech-Stack

- Vite + React + TypeScript (`strict: true`)
- `vite-plugin-pwa` (Service Worker cached nur die App-Shell, niemals Nutzerdaten)
- IndexedDB über die Bibliothek `idb`
- Web Crypto API (keine eigene Krypto, keine Krypto-Libraries von Drittanbietern)
- State: React Context oder Zustand, schlank halten
- Charts: eigene SVG-Komponenten oder eine kleine gebündelte Library (z. B. `recharts`), nichts mit externen Requests
- Datumslogik: `date-fns`, alle Daten als lokale Kalendertage (`YYYY-MM-DD`), keine Zeitzonenfehler
- Tests: Vitest (Unit) und Playwright (ein E2E-Smoke-Test)
- Schriften: Systemschriften (`-apple-system`, `system-ui`)
- Deployment-fähig für GitHub Pages (relative `base`)

---

## 4. Sicherheitsarchitektur

**Bedrohungsmodell (bitte so in der README dokumentieren):** Die App schützt vor Zugriff durch andere Personen am entsperrten Handy, vor anderen Webseiten und vor Datenabfluss an Dritte. Sie ersetzt nicht die Gerätesperre des iPhones. Gegen einen Angreifer mit vollständigem Gerätezugriff und viel Rechenleistung schützt nur eine starke Passphrase.

**Umsetzung:**
- Beim Setup wird ein zufälliger **Data Key** erzeugt (AES-GCM, 256 Bit).
- Dieser Data Key wird zweimal „gewrappt“ (verschlüsselt gespeichert):
  - mit einem Schlüssel aus der **Passphrase/PIN** der Nutzerin (PBKDF2-SHA256, mindestens 600.000 Iterationen, zufälliger 16-Byte-Salt)
  - mit einem Schlüssel aus einem **Wiederherstellungscode** (zufällig, 128 Bit, beim Setup einmalig angezeigt, Base32 in 4er-Gruppen, mit Hinweis zum Aufschreiben)
- Jeder Datensatz wird mit dem Data Key und einem frischen zufälligen 12-Byte-IV verschlüsselt.
- Der entschlüsselte Data Key existiert nur im Arbeitsspeicher als nicht-exportierbarer `CryptoKey`.
- **Auto-Lock:** nach 5 Minuten Inaktivität und wenn die App länger als 60 Sekunden im Hintergrund war (`visibilitychange`).
- Setup bietet „6-stellige PIN“ oder „Passphrase (empfohlen)“ an. Bei PIN ein kurzer, nicht belehrender Hinweis zur geringeren Stärke.
- Nach 5 Fehlversuchen exponentiell steigende Wartezeit (lokal, als Komfortbremse).
- PIN ändern ohne Neuverschlüsselung aller Daten (nur neu wrappen).
- `navigator.storage.persist()` anfragen, damit iOS die Daten nicht verwirft.
- Optional „Sichtschutz“: Inhalte werden unscharf, sobald die App in den Hintergrund geht.
- **Panik-Löschen:** In den Einstellungen „Alle Daten unwiderruflich löschen“ mit Bestätigung durch Eintippen von „LÖSCHEN“.

---

## 5. Datenmodell

```ts
type ISODate = string; // 'YYYY-MM-DD', lokaler Kalendertag

interface DayLog {
  date: ISODate;
  flow?: 'spotting' | 'light' | 'medium' | 'heavy';
  symptoms?: SymptomId[];        // siehe Liste unten
  mood?: MoodId[];
  energy?: 1 | 2 | 3 | 4 | 5;
  sleepQuality?: 1 | 2 | 3 | 4 | 5;
  cervicalMucus?: 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggwhite';
  bbt?: { value: number; time?: string; disturbed?: boolean; reason?: string }; // °C
  lhTest?: 'negative' | 'positive' | 'peak';
  pregnancyTest?: 'negative' | 'positive';
  sex?: { protected?: boolean } [];
  medication?: string[];
  note?: string;
}

interface Cycle {            // abgeleitet, nicht manuell gepflegt
  startDate: ISODate;        // erster Tag mit flow >= 'light'
  endDate?: ISODate;         // Tag vor dem nächsten Start
  periodLength?: number;
  length?: number;
  ovulationDate?: ISODate;   // nur wenn bestätigt (BBT/LH)
  ovulationSource?: 'bbt' | 'lh' | 'bbt+lh';
  lutealLength?: number;
  excluded?: { reason: 'possible_missed_log' | 'pregnancy' | 'postpartum' | 'user'; };
}

interface Settings {
  mode: 'track' | 'conceive' | 'hormonal_contraception';
  birthYear?: number;
  defaultCycleLength?: number;   // aus Onboarding, falls bekannt
  defaultPeriodLength?: number;
  lockMinutes: number;
  theme: 'system' | 'light' | 'dark';
}
```

Zyklen werden **immer aus den Tageseinträgen abgeleitet**, nie separat gespeichert. Eine Periode beginnt am ersten Tag mit mindestens leichter Blutung. Schmierblutung allein startet keinen Zyklus. Zwei Blutungsphasen mit weniger als 3 blutungsfreien Tagen dazwischen gelten als eine Periode.

**Symptomliste (mindestens):** Krämpfe, Kopfschmerzen, Migräne, Brustspannen, Blähungen, Rückenschmerzen, Übelkeit, Akne, Müdigkeit, Heißhunger, Durchfall, Verstopfung, Schlafprobleme, Libido hoch, Libido niedrig, Schwindel, Gelenkschmerzen. **Stimmung:** ruhig, glücklich, energiegeladen, gereizt, traurig, ängstlich, Stimmungsschwankungen, gestresst.

---

## 6. Vorhersage-Engine (Kernprodukt)

Implementiere die gesamte Logik als **reine Funktionen** in `src/engine/`, vollständig unabhängig von der UI, vollständig getestet. Jede Funktion bekommt einen JSDoc-Kommentar mit der wissenschaftlichen Begründung.

### 6.1 Wissenschaftliche Grundlagen (als Konstanten mit Quellenkommentar)

- Große Real-World-Analyse (Bull et al., npj Digital Medicine 2019, ca. 612.000 ovulatorische Zyklen): mittlere Zykluslänge 29,3 Tage, mittlere Follikelphase 16,9 Tage, mittlere Lutealphase 12,4 Tage. Nur ca. 13 % der Zyklen sind genau 28 Tage lang. Die Follikelphase variiert deutlich stärker als die Lutealphase. Daraus folgt: **Eisprung nie pauschal auf Tag 14 setzen.**
- FIGO 2018: normale Zykluslänge 24 bis 38 Tage, Periodendauer bis 8 Tage, Regularität: Differenz zwischen kürzestem und längstem Zyklus normal bis ca. 7 bis 9 Tage (altersabhängig).
- Fruchtbares Fenster (Wilcox et al., NEJM 1995): 6 Tage, nämlich die 5 Tage vor dem Eisprung plus der Eisprungtag. Höchste Wahrscheinlichkeit an den 2 Tagen davor und am Eisprungtag.
- Basaltemperatur: Nach dem Eisprung steigt die Temperatur durch Progesteron typischerweise um ca. 0,2 bis 0,5 °C. Erkennung über die **3-über-6-Regel**: drei aufeinanderfolgende Messungen liegen über der höchsten der sechs vorherigen Messungen (Hilfslinie), die dritte mindestens 0,2 °C darüber.
- LH-Test positiv: Eisprung wahrscheinlich innerhalb von ca. 24 bis 36 Stunden.
- Nutzerinnen vergessen manchmal, eine Periode einzutragen. Dadurch entstehen scheinbar doppelt lange Zyklen, die Vorhersagen verfälschen (Li et al., JAMIA 2022). Diese müssen erkannt werden.

### 6.2 Algorithmus Schritt für Schritt

**A. Datenbereinigung**
1. Zyklen aus Tageseinträgen ableiten. Den laufenden Zyklus nicht in die Statistik aufnehmen.
2. Zyklen < 15 oder > 90 Tage als Ausreißer markieren.
3. **Vergessene Periode erkennen:** Wenn ein Zyklus länger als `1,6 × persönlicher Median` und länger als 45 Tage ist, als `possible_missed_log` markieren, standardmäßig ausschließen und der Nutzerin eine freundliche Rückfrage zeigen („Hast du hier vielleicht eine Periode nicht eingetragen?“) mit Option „Einbeziehen“ oder „Periode nachtragen“.
4. Zyklen im Modus `hormonal_contraception` nicht für Eisprung-Statistik verwenden.

**B. Nächste Periode (Punktschätzung)**
- Verwende bis zu 12 letzte gültige Zyklen.
- Rezenz-Gewichtung: exponentiell, Halbwertszeit 6 Zyklen.
- Robuster Schätzer: gewichteter Median (nicht arithmetisches Mittel), um Ausreißer abzufedern.
- **Kaltstart mit Bayes-Schrumpfung:** `estimate = (n · personal + k · prior) / (n + k)` mit `k = 3`. Prior = Onboarding-Angabe der Nutzerin, sonst 29 Tage. Ab 6 gültigen Zyklen dominiert die persönliche Schätzung.

**C. Unsicherheit**
- Persönliche Streuung robust über MAD × 1,4826, kombiniert mit einer Prior-Streuung von 3 Tagen (gleiche Gewichtung wie oben).
- Zeige ein **80-%-Intervall** als Spanne, z. B. „voraussichtlich 12. bis 15. Nov.“, plus den wahrscheinlichsten Tag.
- Konfidenzstufe in Worten: „niedrig“ (< 3 Zyklen), „mittel“, „hoch“ (≥ 6 Zyklen und Spanne ≤ 4 Tage).
- Wenn die Regularität außerhalb der FIGO-Norm liegt: breitere Spanne und ein neutraler Hinweis.

**D. Eisprung und fruchtbares Fenster**
- Ohne Bestätigung: `Eisprung ≈ vorhergesagter Periodenbeginn − persönliche Lutealphase`. Persönliche Lutealphase = Median bestätigter Lutealphasen, sonst Default 12,4 Tage (Bull 2019), Spanne 11 bis 14.
- Fruchtbares Fenster = Eisprung − 5 bis Eisprung, erweitert um die Vorhersage-Unsicherheit. Tageswahrscheinlichkeit visuell abgestuft (Peak an den Tagen −2 bis 0).
- **Bestätigung im laufenden Zyklus:**
  - BBT: 3-über-6-Regel. Messungen mit `disturbed: true` überspringen. Eisprung = letzter Tag vor der ersten erhöhten Messung.
  - LH: positiver oder Peak-Test → Eisprung am Folgetag (Spanne 0 bis 2 Tage).
  - Beides vorhanden: kombinieren, BBT hat Vorrang für die Bestätigung, LH für die Vorhersage.
- **Wichtigstes Upgrade:** Sobald der Eisprung im laufenden Zyklus bestätigt ist, wird die nächste Periode neu berechnet als `bestätigter Eisprung + persönliche Lutealphase`. Die Spanne wird dadurch deutlich enger. Die UI zeigt das sichtbar an („Vorhersage verfeinert durch Temperaturanstieg“).
- Für abgeschlossene Zyklen mit bestätigtem Eisprung die Lutealphase speichern und in die persönliche Lutealphase einfließen lassen.

**E. Sonderfälle**
- **Verspätete Periode:** Liegt heute nach dem Ende der Spanne, zeige „Periode seit X Tagen später als erwartet“. Wenn ungeschützter Sex im fruchtbaren Fenster geloggt wurde, ruhig einen Schwangerschaftstest ab dem erwarteten Periodentag anregen. Kein Alarmismus.
- **Modus Hormonelle Verhütung:** keine Eisprung- oder Fenstervorhersage, nur Blutungen und Symptome.
- **Modus Kinderwunsch:** fruchtbares Fenster prominenter, BBT/LH-Eingaben hervorgehoben.
- **Gesundheitshinweise** (sanft, mit „Sprich mit deiner Ärztin“-Formulierung, keine Diagnosen): Zyklen dauerhaft < 24 oder > 38 Tage, Periode > 8 Tage, Variabilität über FIGO-Grenze, Ausbleiben > 90 Tage ohne Schwangerschaft.

**F. Symptom-Muster (Insights)**
- Für jedes Symptom die Häufigkeit pro Zyklusphase berechnen (Menstruation, Follikelphase, Eisprung-Fenster, Lutealphase, die letzten 3 Tage vor der Periode).
- Nur Muster zeigen mit mindestens 3 Zyklen Datenbasis und deutlichem Unterschied zur Grundrate (z. B. Lift ≥ 1,5).
- Formulierung: „In 4 von 5 Zyklen hattest du in den 2 Tagen vor der Periode Kopfschmerzen.“
- Vorausschauend: „Erfahrungsgemäß könnten in den nächsten Tagen Krämpfe auftreten.“

**G. Backtesting (Qualitätsnachweis)**
- Funktion `backtest(cycles)`: Für jeden historischen Zyklus ab dem dritten die Vorhersage nur mit den vorherigen Daten berechnen und mit dem echten Start vergleichen.
- Kennzahlen: mittlere absolute Abweichung (MAE) in Tagen und Trefferquote des 80-%-Intervalls.
- In den Insights anzeigen: „Deine Vorhersagen lagen zuletzt im Schnitt ±X Tage daneben.“ Das ist ehrlich und schafft Vertrauen. Orientierungswert: Flo nennt für irreguläre Zyklen nach Einsatz von Machine Learning einen Fehler von ca. 2,6 Tagen. Ein gut kalibriertes statistisches Modell sollte für reguläre Zyklen im Bereich von 1 bis 3 Tagen liegen.

### 6.3 Tests für die Engine (Pflicht)

Schreibe Vitest-Tests mit synthetischen Datensätzen:
- perfekt reguläre 28-Tage-Zyklen
- reguläre 32-Tage-Zyklen
- irreguläre Zyklen (24 bis 38 Tage, zufällig, fester Seed)
- Datensatz mit einer vergessenen Periode (ein 60-Tage-Zyklus)
- Kaltstart mit 0, 1 und 2 Zyklen
- BBT-Kurve mit klarem Anstieg, mit gestörter Messung, ohne Anstieg (anovulatorisch)
- LH-positiv-Fall
- Monats- und Jahreswechsel, Schaltjahr, Sommerzeitumstellung
- Backtest: Intervall-Trefferquote auf synthetischen Daten zwischen 70 % und 90 %

---

## 7. Funktionen und Screens (Flo als Referenz)

**Onboarding (max. 5 Schritte):** Begrüßung und Datenschutzversprechen in einfachen Worten → Passphrase/PIN setzen → Wiederherstellungscode anzeigen und Bestätigung „Ich habe ihn notiert“ → letzte Periode und ungefähre Zykluslänge (überspringbar) → Modus wählen → Hinweis „Kein Verhütungsmittel“.

**Heute (Startscreen):**
- Großer Zyklusring: aktueller Zyklustag, Phase farbig, Markierungen für Periode, fruchtbares Fenster, Eisprung.
- Klare Hauptaussage: „Periode in 5 Tagen“ / „Tag 2 deiner Periode“ / „Hohe Fruchtbarkeit“ plus Spanne und Konfidenz.
- Ein Button „Periode begonnen“ bzw. „Periode beendet“ (ein Tap).
- „Heute eintragen“ öffnet das Tagesprotokoll.
- Eine passende Insight-Karte.

**Tagesprotokoll:** Bottom Sheet mit Chips, Ziel: Eintrag in unter 10 Sekunden. Bereiche: Blutung, Symptome, Stimmung, Energie, Schlaf, Ausfluss, Temperatur, LH-Test, Schwangerschaftstest, Sex, Medikamente, Notiz. Häufig genutzte Symptome nach oben sortieren. Auch für vergangene Tage nutzbar.

**Kalender:** Monatsansicht mit vergangenen Perioden (gefüllt), vorhergesagten Perioden (gestrichelt), fruchtbarem Fenster, Eisprung, Punkten für Einträge. Tippen auf einen Tag öffnet sein Protokoll. Bearbeitungsmodus, um mehrere vergangene Periodentage schnell per Tippen nachzutragen.

**Insights:**
- Verlauf Zykluslänge (Balkendiagramm) mit Normbereich 24 bis 38 Tage hinterlegt
- Verlauf Periodendauer
- Durchschnitt, Spanne, Regularität mit verständlicher Einordnung
- BBT-Kurve des aktuellen Zyklus mit Hilfslinie
- Symptom-Muster (siehe 6.2 F)
- Vorhersagegenauigkeit aus dem Backtest
- Export als PDF-ähnliche Druckansicht für Arzttermine (`window.print()`, kein externer Dienst)

**Einstellungen:** Modus, PIN ändern, Auto-Lock-Zeit, Theme, Export, Import, Kalender-Export, Daten löschen, Über die App (Methodik und Quellen in Klartext).

**Erinnerungen ohne Server:** iOS-PWAs können ohne Push-Server keine zuverlässigen lokalen Benachrichtigungen planen. Löse das ehrlich: Biete einen **.ics-Export** der vorhergesagten Perioden an (lokal generierte Datei, Termin-Titel neutral und konfigurierbar, z. B. „L“), den sie in ihren Kalender importieren kann. Dokumentiere diese Einschränkung.

---

## 8. Import und Export

- **Schnellnachtrag:** Im Kalender vergangene Periodenstarts antippen. Der zuverlässigste Weg für Altdaten.
- **CSV-Import:** Datei wählen → Vorschau der ersten Zeilen → Spalten zuordnen (Datum, Datumsformat, optional Ende/Blutung/Symptome) → Validierung → Import. Unterstütze gängige Formate (`YYYY-MM-DD`, `DD.MM.YYYY`, `MM/DD/YYYY`). Robust gegenüber Semikolon- und Komma-Trennzeichen.
- **JSON-Import:** generischer Importer mit derselben Zuordnungsmaske. Flo stellt Daten nur auf Anfrage bereit und das Format ist nicht garantiert. Deshalb keinen festen Flo-Parser annehmen, sondern die Zuordnungsmaske flexibel bauen.
- **Verschlüsseltes Backup:** Export als `.luna`-Datei (JSON mit Version, Salt, IV, Ciphertext). Import mit Passphrase oder Wiederherstellungscode. Erinnerung im Heute-Screen, wenn das letzte Backup älter als 30 Tage ist.
- **Klartext-CSV-Export:** möglich, aber mit klarem Warnhinweis.
- Datei-Download und -Upload rein lokal über `Blob` und `<input type="file">`, nichts verlässt das Gerät ungefragt.

---

## 9. Design

- Mobile-first, iPhone-optimiert, `safe-area-inset` beachten, als Homescreen-App im Standalone-Modus.
- Warm, ruhig, erwachsen. Kein Kitsch. Sanfte Palette: Periode in gedecktem Rosé/Rot, fruchtbares Fenster in Türkis, Eisprung kräftiger Akzent, Lutealphase in sanftem Violett. Dark Mode vollwertig.
- Große Touch-Ziele (≥ 44 px), weiche Animationen, `prefers-reduced-motion` respektieren.
- Barrierefreiheit: ARIA-Labels, ausreichender Kontrast (WCAG AA), Farben nie als einzige Informationsquelle.
- App-Icon und Splashscreen neutral (kein offensichtliches Perioden-Symbol, für Diskretion auf dem Homescreen).
- Leere Zustände sind freundlich und erklären, was als Nächstes passiert.

---

## 10. Projektstruktur

```
src/
  engine/        # reine Vorhersage- und Analyse-Logik + Tests
  crypto/        # Key-Handling, Verschlüsselung + Tests
  storage/       # IndexedDB-Repository (arbeitet nur mit Ciphertext)
  import-export/ # CSV, JSON, Backup, ICS + Tests
  ui/            # Komponenten, Screens
  i18n/de.ts     # alle Texte zentral
scripts/
  privacy-check.ts  # schlägt fehl, wenn fetch/XMLHttpRequest/WebSocket/sendBeacon/externe URLs im Build vorkommen
```

---

## 11. Arbeitsweise

1. **Plane zuerst:** Lege eine kurze `PLAN.md` mit Architektur, Phasen und offenen Annahmen an. Triff sinnvolle Annahmen selbst, statt nachzufragen, und dokumentiere sie dort.
2. **Baue in dieser Reihenfolge:** Engine + Tests → Crypto + Storage + Tests → Onboarding und Lock → Heute + Tagesprotokoll → Kalender → Insights → Import/Export → Design-Feinschliff → PWA → E2E-Test.
3. Nach jeder Phase `npm test` ausführen und Fehler beheben, bevor du weitermachst.
4. Am Ende `npm run build` und `npm run privacy-check` ausführen.
5. **Selbst-Audit zum Schluss:** Gehe die Abschnitte 2, 4 und 6 als Checkliste durch und berichte für jeden Punkt „erfüllt“ oder „nicht erfüllt, weil …“.
6. Schreibe eine `README.md` auf Deutsch: Installation, lokales Starten, Deployment auf GitHub Pages, Installation auf dem iPhone (Safari → Teilen → Zum Home-Bildschirm), Bedrohungsmodell, Methodik der Vorhersage mit Quellen, bekannte Grenzen.

---

## 12. Definition of Done

- Alle Tests grün, Build läuft, Privacy-Check besteht.
- Die App funktioniert offline im Flugmodus vollständig.
- Mit 6 synthetischen 28-Tage-Zyklen zeigt die App die nächste Periode korrekt mit enger Spanne und hoher Konfidenz.
- Nach Eingabe eines BBT-Anstiegs verfeinert sich die Vorhersage sichtbar.
- Sperren, Entsperren, PIN ändern, Wiederherstellung per Code, Backup-Export und -Import funktionieren durchgängig.
- In IndexedDB ist kein Klartext-Gesundheitsdatum sichtbar (per Test geprüft).
- Hinweis „Kein Verhütungsmittel, kein Medizinprodukt“ ist im Onboarding und in den Einstellungen sichtbar.

Beginne jetzt mit `PLAN.md`.
