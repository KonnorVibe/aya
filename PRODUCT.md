# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Freundinnen und Bekannte des Entwicklers, Gelegenheitsnutzerinnen auf dem iPhone, keine Technik-Affinität vorausgesetzt. Sie öffnen die App kurz, oft unterwegs oder abends, um einen Tag einzutragen oder nachzusehen, wann die nächste Periode kommt.

## Product Purpose
Zyklus-Tracking als installierbare PWA: Eintrag in unter 10 Sekunden, ehrliche Vorhersage der nächsten Periode mit Spanne und Konfidenz, die mit jedem Zyklus besser wird. Erfolg: Die Nutzerin vertraut der Vorhersage und muss nie über Datenschutz nachdenken.

## Positioning
Funktionsumfang und Bedienqualität wie Flo, aber alles bleibt verschlüsselt auf dem Gerät: kein Account, kein Server, keine Cloud, kein Tracking, keine Netzwerkanfrage nach dem Laden.

## Operating Context
Homescreen-App im Standalone-Modus auf dem iPhone, Safari/WebKit. Kurze Sitzungen, einhändig. Backups als `.aya`-Datei über das Teilen-Sheet. Erinnerungen nur über `.ics`-Export in den eigenen Kalender.

## Capabilities and Constraints
- Zero Network: Systemschriften, keine CDNs, keine Webfonts, keine externen Bilder; CSP `connect-src 'none'`.
- Daten nur verschlüsselt in IndexedDB (Geräteschlüssel, optionale PIN als App-Sperre).
- Kein Verhütungsmittel, kein Medizinprodukt; das steht im Onboarding und in den Einstellungen.
- Modi: Zyklus verfolgen (Standard), Kinderwunsch, hormonelle Verhütung.
- v1 schlank, „Erweiterte Funktionen“ (BBT, LH, CSV, Druckansicht) per Schalter.
- UI Deutsch.

## Brand Commitments
- Name „aya“, immer kleingeschrieben.
- Ansprache: du, ruhig, sachlich-warm, wie eine kluge Freundin. Nie belehrend, kein Kitsch, keine Emojis, kein Alarmismus.
- Farbvorgaben aus dem Brief: Periode gedecktes Rosé/Rot, fruchtbares Fenster Türkis, Eisprung kräftiger Akzent, Lutealphase sanftes Violett. Vollwertiger Dark Mode.
- App-Icon neutral, kein offensichtliches Perioden-Symbol (Diskretion auf dem Homescreen).
- Kein Logo, keine Wortmarke vorhanden.

## Evidence on Hand
Keine Testimonials, Nutzerzahlen oder Studien eigener Art. Quellen der Methodik: Bull et al. 2019, FIGO 2018, Wilcox et al. 1995, Li et al. 2022 (siehe `src/engine/constants.ts`). Nichts davon darf als Werbeaussage erfunden oder überhöht werden.

## Product Principles
1. Ehrlichkeit vor Präzisionsschein: jede Vorhersage zeigt Spanne und Konfidenz.
2. Privatsphäre ist Architektur, nicht Einstellung.
3. Ein Tap für das Häufigste, alles andere ruhig dahinter.
4. Sanft bei Gesundheitshinweisen: einordnen, an die Ärztin verweisen, nie diagnostizieren.

## Accessibility & Inclusion
WCAG AA, Touch-Ziele ≥ 44 px, `prefers-reduced-motion`, Farbe nie als einzige Informationsquelle, Dynamic-Type-freundliche Größen.
