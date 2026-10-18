# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> onboarding, logging, encryption at rest, passphrase switch, lock, offline and import
- Location: e2e/smoke.spec.ts:40:1

# Error details

```
Error: Channel closed
```

```
Error: expect(locator).toHaveText(expected) failed

Locator: locator('.recovery-code')
Expected pattern: /^([A-Z2-7]{4} ){6}[A-Z2-7]{2}$/
Error: element(s) not found

Call log:
  - Expect "toHaveText" locator('.recovery-code') with timeout 30000ms
  - waiting for locator('.recovery-code')
  - Target page, context or browser has been closed
Browser logs:

<launching> /tmp/chromium --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,BlockOriginHeaderModificationOnRedirect,AvoidCorsURLLoaderRestartOnRedirect,Translate,AutoDeElevate,OptimizationHints,NetworkTimeServiceQuerying,AimEnabled,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --disable-updater-scheduler --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --no-sandbox --user-data-dir=/tmp/playwright_chromiumdev_profile-UogI4j --remote-debugging-pipe --no-startup-window
<launched> pid=5655
[pid=5655][err] [1018/180957.006034:WARNING:../sandbox/policy/linux/sandbox_linux.cc:405] InitializeSandbox() called with multiple threads in process gpu-process.
[pid=5655] <gracefully close start>
[pid=5655] <forcefully close>
[pid=5655] <kill>
[pid=5655] <will force kill>

```

```yaml
- main:
  - heading "Einstellungen" [level=1]
  - region "Allgemein":
    - heading "Allgemein" [level=2]
    - group "Modus":
      - text: Modus
      - radio "Zyklus verfolgen Periode, Symptome und Vorhersagen." [checked]
      - text: Zyklus verfolgen Periode, Symptome und Vorhersagen.
      - radio "Kinderwunsch Fruchtbare Tage stehen im Vordergrund."
      - text: Kinderwunsch Fruchtbare Tage stehen im Vordergrund.
      - radio "Hormonelle Verhütung Blutungen und Symptome, ohne Eisprung-Vorhersage."
      - text: Hormonelle Verhütung Blutungen und Symptome, ohne Eisprung-Vorhersage.
    - group "Darstellung":
      - text: Darstellung
      - radio "System" [checked]
      - text: System
      - radio "Hell"
      - text: Hell
      - radio "Dunkel"
      - text: Dunkel
    - text: Geburtsjahr
    - combobox "Geburtsjahr":
      - option "keine Angabe" [selected]
      - option "2014"
      - option "2013"
      - option "2012"
      - option "2011"
      - option "2010"
      - option "2009"
      - option "2008"
      - option "2007"
      - option "2006"
      - option "2005"
      - option "2004"
      - option "2003"
      - option "2002"
      - option "2001"
      - option "2000"
      - option "1999"
      - option "1998"
      - option "1997"
      - option "1996"
      - option "1995"
      - option "1994"
      - option "1993"
      - option "1992"
      - option "1991"
      - option "1990"
      - option "1989"
      - option "1988"
      - option "1987"
      - option "1986"
      - option "1985"
      - option "1984"
      - option "1983"
      - option "1982"
      - option "1981"
      - option "1980"
      - option "1979"
      - option "1978"
      - option "1977"
      - option "1976"
      - option "1975"
      - option "1974"
      - option "1973"
      - option "1972"
      - option "1971"
      - option "1970"
      - option "1969"
      - option "1968"
      - option "1967"
      - option "1966"
      - option "1965"
    - paragraph: Freiwillig. Nur für die altersabhängige Einordnung der Regelmäßigkeit.
  - region "Schutz":
    - heading "Schutz" [level=2]
    - text: Schutzart Passphrase
    - paragraph: Deine Daten öffnen sich nur mit deiner Passphrase oder dem Wiederherstellungscode. aya sperrt sich automatisch.
    - text: Automatisch sperren nach
    - combobox "Automatisch sperren nach":
      - option "1 Minute"
      - option "5 Minuten" [selected]
      - option "15 Minuten"
    - paragraph: Und immer, wenn aya länger als eine Minute im Hintergrund war.
    - text: Sichtschutz
    - switch "Sichtschutz"
    - paragraph: Macht den Inhalt unscharf, sobald aya in den Hintergrund geht.
    - button "Passphrase ändern"
    - button "Neuen Wiederherstellungscode erzeugen"
    - button "Zurück zum Geräteschutz"
  - region "Deine Daten":
    - heading "Deine Daten" [level=2]
    - paragraph: "Letztes Backup: Sonntag, 18. Oktober"
    - button "Backup erstellen"
    - button "Backup laden"
    - button "Daten importieren"
    - button "Als CSV exportieren"
    - button "Kalender-Export"
    - button "Alle Daten löschen"
  - region "Über aya":
    - heading "Über aya" [level=2]
    - paragraph: aya ist kein Verhütungsmittel und kein Medizinprodukt.
    - paragraph: aya speichert alles verschlüsselt auf diesem Gerät und stellt keine Verbindung ins Internet her.
    - paragraph:
      - link "Datenschutz und Sicherheit":
        - /url: ./datenschutz.html
      - link "Impressum":
        - /url: ./impressum.html
    - group: Methodik und Quellen
- navigation "Hauptnavigation":
  - button "Heute"
  - button "Kalender"
  - button "Einblicke"
  - button "Einstellungen"
```

```
Error: browserContext.close: Target page, context or browser has been closed
```