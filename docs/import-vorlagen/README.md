# Import-Vorlagen

Testdateien für den Datenimport in **Einstellungen → Daten importieren**. Sie enthalten erfundene Daten.

| Datei | Zweck |
|---|---|
| `perioden.csv` | Eine Zeile pro Periode, deutsches Datumsformat, Semikolon. So sehen viele eigene Tabellen aus. |
| `flo-beispiel.json` | **Erfundene** Struktur im Stil eines Flo-Exports. Flo veröffentlicht sein JSON-Format nicht, deshalb testet diese Datei nur die automatische Erkennung von verschachtelten Perioden-Listen. Eine echte Flo-Datei kann anders aufgebaut sein; dann hilft die Zuordnungsmaske. |
| `apple-health-export.xml` | Aufbau wie `export.xml` aus dem Apple-Health-Export (Health → Profil → „Alle Gesundheitsdaten exportieren“). Enthält Periode, Basaltemperatur und einen LH-Test mit Quelle „Flo“. |

Eine echte Flo-Datei bekommst du über den Support-Chat in der Flo-App (Anfrage „Datenexport im JSON-Format“). Alternativ: In Flo die Verbindung zu Apple Health einschalten, dann den Health-Export in aya importieren.
