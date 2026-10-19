import { diffDays, type ISODate } from '../engine/dates.ts';
import type { Confidence, Prediction } from '../engine/prediction.ts';

const dayMonth = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthYear = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const weekdayLong = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const toDate = (d: ISODate) => new Date(`${d}T00:00:00Z`);

export function formatDayMonth(d: ISODate): string {
  return dayMonth.format(toDate(d));
}

export function formatMonthYear(year: number, month: number): string {
  return monthYear.format(new Date(Date.UTC(year, month - 1, 1)));
}

export function formatLongDate(d: ISODate): string {
  return weekdayLong.format(toDate(d));
}

/** "20.–22. Okt." or "30. Okt. – 2. Nov." */
export function formatRange(from: ISODate, to: ISODate): string {
  if (from === to) return formatDayMonth(from);
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8))}.–${formatDayMonth(to)}`;
  return `${formatDayMonth(from)} – ${formatDayMonth(to)}`;
}

const days = (n: number) => (n === 1 ? '1 Tag' : `${n} Tagen`);

export const confidenceLabel: Record<Confidence, string> = {
  low: 'Sicherheit\u00a0niedrig',
  medium: 'Sicherheit\u00a0mittel',
  high: 'Sicherheit\u00a0hoch',
};

/** The one sentence the Today screen leads with. */
export function statement(p: Prediction, today: ISODate): string {
  if (p.periodDay) return `Tag ${p.periodDay} deiner Periode`;
  if (p.lateByDays !== undefined) return p.lateByDays === 1 ? 'Periode seit 1 Tag später' : `Periode seit ${p.lateByDays} Tagen später`;
  const until = diffDays(p.nextPeriod.mostLikely, today);
  if (until <= 0) return 'Periode heute erwartet';
  if (p.ovulation && p.fertileWindow && today >= p.fertileWindow.peakStart && today <= p.fertileWindow.peakEnd) {
    return 'Hohe Fruchtbarkeit';
  }
  return until === 1 ? 'Periode morgen' : `Periode in ${days(until)}`;
}

export const de = {
  appName: 'aya',
  periodStarted: 'Periode begonnen',
  periodEnded: 'Periode beendet',
  logToday: 'Heute eintragen',
  expected: 'voraussichtlich',
  cycleDayOf: (n: number) => `Zyklustag von etwa ${n}`,
  ringLabel: (day: number, length: number, range: string) =>
    `Zyklustag ${day} von etwa ${length}. Nächste Periode voraussichtlich ${range}.`,
  legend: {
    period: 'Periode',
    fertile: 'fruchtbar',
    ovulation: 'Eisprung',
    luteal: 'Lutealphase',
    forecast: 'Vorhersage',
    today: 'heute',
    flow: 'Blutung',
    flowLight: 'schwach',
    flowHeavy: 'stark',
  },
  ringPhase: { period: 'Periode', fertile: 'fruchtbar', luteal: 'Lutealphase' },
  log: {
    title: (date: string, isToday: boolean) => (isToday ? 'Heute' : date),
    done: 'Fertig',
    flow: 'Blutung',
    flows: { none: 'keine', spotting: 'Schmierblutung', light: 'leicht', medium: 'mittel', heavy: 'stark' },
    symptoms: 'Symptome',
    mood: 'Stimmung',
    energy: 'Energie',
    energyLevels: ['sehr wenig', 'wenig', 'mittel', 'viel', 'sehr viel'],
    sleep: 'Schlaf',
    sleepLevels: ['sehr schlecht', 'schlecht', 'okay', 'gut', 'sehr gut'],
    sex: 'Sex',
    sexProtected: 'geschützt',
    sexUnprotected: 'ungeschützt',
    note: 'Notiz',
    notePlaceholder: 'Was dir heute auffällt',
    more: 'Weitere Angaben',
    moreHint: 'Temperatur, Tests, Zervixschleim, Medikamente',
    bbt: 'Basaltemperatur',
    bbtLabel: 'Temperatur in °C',
    bbtTime: 'Uhrzeit',
    bbtInvalid: 'Bitte einen Wert zwischen 34 und 42 °C, zum Beispiel 36,55.',
    bbtDisturbed: 'Messung gestört',
    bbtReason: 'Grund (optional)',
    bbtReasonPlaceholder: 'z. B. schlecht geschlafen, Alkohol, krank',
    bbtHint: 'Morgens vor dem Aufstehen messen, immer zur gleichen Zeit.',
    lh: 'LH-Test',
    lhResults: { negative: 'negativ', positive: 'positiv', peak: 'Spitze' },
    pregnancy: 'Schwangerschaftstest',
    pregnancyResults: { negative: 'negativ', positive: 'positiv' },
    mucus: 'Zervixschleim',
    mucusTypes: { dry: 'trocken', sticky: 'klebrig', creamy: 'cremig', watery: 'wässrig', eggwhite: 'spinnbar' },
    medication: 'Medikamente',
    medicationPlaceholder: 'Mit Komma trennen, z. B. Ibuprofen, Eisen',
    summary: 'Heute eingetragen',
  },
  symptomLabels: {
    cramps: 'Krämpfe',
    headache: 'Kopfschmerzen',
    migraine: 'Migräne',
    breast_tenderness: 'Brustspannen',
    bloating: 'Blähungen',
    back_pain: 'Rückenschmerzen',
    nausea: 'Übelkeit',
    acne: 'Akne',
    fatigue: 'Müdigkeit',
    cravings: 'Heißhunger',
    diarrhea: 'Durchfall',
    constipation: 'Verstopfung',
    insomnia: 'Schlafprobleme',
    libido_high: 'Libido hoch',
    libido_low: 'Libido niedrig',
    dizziness: 'Schwindel',
    joint_pain: 'Gelenkschmerzen',
  },
  moodLabels: {
    calm: 'ruhig',
    happy: 'glücklich',
    energetic: 'energiegeladen',
    irritable: 'gereizt',
    sad: 'traurig',
    anxious: 'ängstlich',
    mood_swings: 'Stimmungsschwankungen',
    stressed: 'gestresst',
  },
  notes: {
    backupNever:
      'Du hast noch kein Backup. Ein Backup ist der einzige Weg, deine Daten auf ein neues Gerät mitzunehmen. Du findest es in den Einstellungen.',
    backup: 'Dein letztes Backup ist über 30 Tage alt. Ein aktuelles Backup ist der einzige Weg, deine Daten auf ein neues Gerät mitzunehmen.',
    late: (n: number) => (n === 1 ? 'Deine Periode ist 1 Tag später als erwartet. Das kommt oft vor.' : `Deine Periode ist ${n} Tage später als erwartet. Das kommt oft vor.`),
    pregnancyTest:
      'Du hast in deinem fruchtbaren Fenster ungeschützten Sex eingetragen. Ab jetzt ist ein Schwangerschaftstest aussagekräftig.',
    refinedBbt: 'Vorhersage verfeinert durch deinen Temperaturanstieg.',
    refinedLh: 'Vorhersage verfeinert durch deinen positiven LH-Test.',
    irregular: 'Deine Zyklen schwanken stärker als üblich, deshalb ist die Spanne breiter.',
    fertileWindow: (range: string) => `Fruchtbares Fenster voraussichtlich ${range}.`,
    upcoming: (list: string) => `Erfahrungsgemäß könnten in den nächsten Tagen ${list} auftreten.`,
    health: {
      short_cycles: 'Deine Zyklen sind meist kürzer als 24 Tage. Sprich bei Gelegenheit mit deiner Ärztin darüber.',
      long_cycles: 'Deine Zyklen sind meist länger als 38 Tage. Sprich bei Gelegenheit mit deiner Ärztin darüber.',
      long_periods: 'Deine Perioden dauerten zuletzt öfter länger als 8 Tage. Sprich bei Gelegenheit mit deiner Ärztin darüber.',
      high_variability: 'Deine Zykluslängen schwanken stark. Sprich bei Gelegenheit mit deiner Ärztin darüber.',
      absent_period: 'Deine letzte Periode liegt über 90 Tage zurück. Sprich mit deiner Ärztin darüber.',
    },
  },
  calendar: {
    title: 'Kalender',
    prev: 'Vorheriger Monat',
    next: 'Nächster Monat',
    weekdays: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    edit: 'Periode nachtragen',
    editDone: 'Fertig',
    editHint: 'Tippe auf die Tage, an denen du deine Periode hattest. Nochmal tippen entfernt sie.',
    toToday: 'Heute',
    missed: (from: string, to: string, days: number) =>
      `Zwischen ${from} und ${to} liegen ${days} Tage ohne Periode. Hast du hier vielleicht eine Periode nicht eingetragen?`,
    missedAdd: 'Periode nachtragen',
    missedKeep: 'Stimmt so',
    legendPredicted: 'erwartete Periode',
    legendEntry: 'Eintrag',
    dayLabel: (date: string, parts: string[]) => [date, ...parts].join(', '),
    states: {
      logged: 'Periode',
      spotting: 'Schmierblutung',
      predicted: 'erwartete Periode',
      peak: 'hohe Fruchtbarkeit',
      high: 'fruchtbar',
      ovulation: 'voraussichtlicher Eisprung',
      entry: 'Eintrag vorhanden',
      today: 'heute',
    },
  },
  insights: {
    title: 'Muster',
    kanji: '綾',
    subtitle: 'Hier siehst du das Muster, das dein Zyklus über die Monate webt.',
    more: 'Mehr erfahren',
    cycleLength: 'Zykluslänge',
    periodLength: 'Periodendauer',
    average: 'Durchschnitt',
    range: 'Spanne',
    regularity: 'Regelmäßigkeit',
    regular: 'regelmäßig',
    irregular: 'unregelmäßig',
    unknown: 'noch offen',
    days: (n: number) => (n === 1 ? '1 Tag' : `${n} Tage`),
    rangeValue: (a: number, b: number) => (a === b ? `${a} Tage` : `${a}–${b} Tage`),
    regularityText: (variation: number, limit: number) =>
      `Zwischen deinem kürzesten und längsten Zyklus liegen ${variation} ${variation === 1 ? 'Tag' : 'Tage'}. Bis ${limit} Tage gelten als regelmäßig.`,
    regularityPending: 'Ab drei vollständigen Zyklen kann aya einschätzen, wie regelmäßig dein Zyklus ist.',
    cycleChartNote: 'Der hinterlegte Bereich zeigt die übliche Spanne von 24 bis 38 Tagen.',
    periodChartNote: 'Die Linie markiert 8 Tage, bis dahin gilt eine Periode als üblich.',
    excluded: 'nicht mitgezählt',
    normBand: 'üblich 24–38',
    periodLimit: 'bis 8',
    empty: 'Sobald du zwei Perioden eingetragen hast, siehst du hier deine Zykluslängen.',
    patterns: 'Muster bei Symptomen',
    patternsEmpty: 'Muster erscheinen, wenn du über mindestens drei Zyklen Symptome einträgst.',
    pattern: (withN: number, total: number, phase: string, symptom: string) =>
      `In ${withN} von ${total} Zyklen hattest du ${phase} ${symptom}.`,
    phases: {
      menstruation: 'während der Periode',
      follicular: 'in den Tagen nach der Periode',
      ovulation: 'rund um den Eisprung',
      luteal: 'in der zweiten Zyklushälfte',
      premenstrual: 'in den drei Tagen vor der Periode',
    },
    table: 'Als Tabelle anzeigen',
    tableStart: 'Beginn',
    tableCycle: 'Zyklus',
    tablePeriod: 'Periode',
    selected: (date: string, value: string) => `${date}: ${value}`,
    chartLabel: (title: string, count: number) => `${title} der letzten ${count} Zyklen`,
    temperature: 'Temperatur in diesem Zyklus',
    temperatureEmpty: 'Trag morgens deine Temperatur ein. Nach ein paar Tagen erscheint hier deine Kurve.',
    temperatureLabel: (n: number) => `Basaltemperatur, ${n} Messungen in diesem Zyklus`,
    temperatureReading: (date: string, day: number, value: string, disturbed: boolean) =>
      `${date}, Zyklustag ${day}: ${value} °C${disturbed ? ' (gestört, nicht gewertet)' : ''}`,
    coverline: 'Hilfslinie',
    ovulationMark: 'Eisprung',
    temperatureRise: (date: string) => `Der Temperaturanstieg bestätigt den Eisprung am ${date}. Deine nächste Periode berechnet aya jetzt daraus.`,
    temperatureNoRise: 'Noch kein Anstieg nach der 3-über-6-Regel. Gestörte Messungen zählt aya nicht mit.',
    accuracy: 'Wie genau aya bei dir ist',
    accuracyPending: 'Nach drei Zyklen kann aya prüfen, wie genau die Vorhersagen bei dir sind.',
    accuracyText: (n: number, mae: string, hits: number) =>
      `aya hat ${n} deiner Zyklen nachträglich vorhergesagt, nur mit den Daten davor. Im Mittel lag der wahrscheinlichste Tag ${mae} daneben. ${hits} von ${n} Mal lag der echte Beginn in der angezeigten Spanne.`,
    accuracyDays: (d: number) => (d < 0.95 ? 'weniger als einen Tag' : d < 1.5 ? 'etwa einen Tag' : `etwa ${Math.round(d)} Tage`),
    print: 'Übersicht drucken',
    printHint: 'Für Arzttermine. Du kannst die Übersicht als PDF sichern oder ausdrucken. Es wird nichts verschickt.',
    printTitle: 'Zyklusübersicht',
    printCreated: (date: string) => `Erstellt am ${date} mit aya`,
    printHealth: 'Hinweise',
    printNoHealth: 'Keine Auffälligkeiten nach den FIGO-Grenzen.',
  },
  /**
   * The line above the statement on Today. Each one follows what the body is actually doing in that
   * phase (see the Wissen page) and says "viele" rather than "du": cycles differ.
   */
  quotePhase: {
    menstruation: 'Periode',
    follicular: 'Follikelphase',
    ovulation: 'Rund um den Eisprung',
    luteal: 'Lutealphase',
    premenstrual: 'Vor der Periode',
    late: 'Periode später',
    hormonal: 'Heute',
  },
  quotes: {
    menstruation: [
      'Dein Körper erneuert gerade die Gebärmutterschleimhaut. Ruhe ist jetzt keine Faulheit.',
      'Östrogen und Progesteron sind gerade am niedrigsten. Wärme und Bewegung im eigenen Tempo helfen vielen.',
      'Ein neuer Zyklus beginnt heute schon. Gönn dir einen langsamen Start.',
      'Eisenreiches Essen tut jetzt gut. Linsen, Spinat und ein Glas Orangensaft dazu.',
    ],
    follicular: [
      'Das Östrogen steigt. Viele spüren jetzt mehr Energie und Lust auf Neues.',
      'Gute Tage, um etwas anzufangen. Dein Körper baut gerade auf.',
      'Mit dem Östrogen kehrt bei vielen die Leichtigkeit zurück. Nimm sie mit.',
      'Ein Eibläschen reift heran. Du darfst heute auch etwas wachsen lassen.',
    ],
    ovulation: [
      'Rund um den Eisprung fühlen sich viele besonders wach und gesellig.',
      'Östrogen auf dem Höhepunkt. Ein guter Tag für das Gespräch, das du aufgeschoben hast.',
      'Dein Körper ist gerade auf Hochtouren. Genieß den Schwung.',
      'Deine Temperatur steigt bald leicht an. Dein Körper hält sich an seinen Plan.',
    ],
    luteal: [
      'Jetzt übernimmt das Progesteron. Es macht ruhiger und manchmal müder. Beides ist in Ordnung.',
      'Zeit zum Fertigmachen statt Anfangen. Die zweite Zyklushälfte mag Ordnung.',
      'Dein Grundumsatz ist gerade etwas höher. Hunger ist jetzt ein Signal, kein Fehler.',
      'Etwas mehr Schlaf tut vielen jetzt gut. Hör auf dich.',
    ],
    premenstrual: [
      'Die Hormone sinken, bald beginnt ein neuer Zyklus. Sei heute besonders freundlich zu dir.',
      'Gereizt oder dünnhäutig? Das ist bei vielen jetzt so, und es geht vorbei.',
      'Ein warmes Getränk, ein früher Abend. Du musst heute nichts beweisen.',
      'Bewegung und genug Schlaf machen die Tage vor der Periode für viele leichter.',
    ],
    late: [
      'Später als gedacht kommt oft vor. Stress, Reisen oder Krankheit verschieben den Eisprung.',
      'Ein Zyklus darf mal aus der Reihe tanzen. aya rechnet weiter mit.',
    ],
    hormonal: [
      'Schön, dass du da bist. Jeder Eintrag hilft dir, deinen Körper besser zu kennen.',
      'Auch mit hormoneller Verhütung lohnt es sich, Symptome und Stimmung festzuhalten.',
      'Hör heute auf das, was dein Körper dir sagt.',
    ],
  },
  importPage: {
    title: 'Alte Daten importieren',
    intro: 'Woher kommen deine Daten? aya liest die Datei nur hier auf deinem Gerät.',
    private: 'Die Datei verlässt dein iPhone nicht. Bestehende Einträge bleiben erhalten.',
    how: 'So bekommst du die Datei',
    file: 'Datei auswählen',
    toToday: 'Zu Heute',
    sources: {
      health: {
        label: 'Apple Health',
        hint: 'Auch für Apps, die in Health schreiben, etwa Flo oder Clue.',
        steps: [
          'Öffne die App Health und tippe oben rechts auf dein Profilbild.',
          'Tippe ganz unten auf „Alle Gesundheitsdaten exportieren“ und bestätige.',
          'Sichere die Datei export.zip in „Dateien“.',
          'Wähle sie unten aus. aya übernimmt nur die Zyklusdaten.',
        ],
      },
      flo: {
        label: 'Flo',
        hint: 'Direkt aus der Flo-App, ohne Apple Health.',
        steps: [
          'Öffne in Flo dein Profil und dann die Einstellungen.',
          'Fordere unter Datenschutz eine Kopie deiner Daten an. Flo schickt sie dir per E-Mail. Je nach Version heißt der Punkt etwas anders.',
          'Sichere die Datei aus der E-Mail in „Dateien“ und wähle sie unten aus.',
          'Tipp: Ist Flo mit Apple Health verbunden, geht es über Apple Health schneller.',
        ],
      },
      other: {
        label: 'Andere App oder Tabelle',
        hint: 'CSV- oder JSON-Datei, zum Beispiel aus Clue oder einer eigenen Tabelle.',
        steps: [
          'Exportiere deine Daten in der anderen App als CSV oder JSON. Eine Tabelle aus Numbers oder Excel speicherst du als CSV.',
          'Wähle die Datei unten aus.',
          'aya zeigt dir eine Vorschau und fragt, welche Spalte das Datum und welche die Blutung enthält.',
        ],
      },
      backup: {
        label: 'aya-Backup',
        hint: 'Eine .aya-Datei von diesem oder einem anderen Gerät.',
        steps: [
          'Wähle die Backup-Datei aus und gib das Passwort ein, das du beim Erstellen vergeben hast.',
          'Achtung: Das Backup ersetzt alles, was gerade in aya gespeichert ist.',
        ],
      },
    },
  },
  method: {
    title: 'Methodik und Quellen',
    back: 'Zurück',
    intro: 'So rechnet aya. Alles läuft auf deinem Gerät, mit offenen und überprüfbaren Methoden aus der Forschung.',
    sections: [
      {
        title: 'Nächste Periode',
        body: [
          'aya schaut auf deine letzten bis zu 12 Zyklen. Neuere Zyklen zählen stärker als ältere, und ein gewichteter Median sorgt dafür, dass ein einzelner Ausreißer die Vorhersage nicht verzieht.',
          'Solange erst wenige Zyklen vorliegen, mischt aya einen Durchschnittswert von 29 Tagen oder deine Angabe aus dem Start dazu. Mit jedem Zyklus zählt dein eigener Wert mehr, ab dem sechsten nur noch er.',
        ],
      },
      {
        title: 'Die Spanne',
        body: [
          'aya nennt nie nur einen Tag. Die Spanne ist ein 80-%-Intervall: In etwa vier von fünf Fällen beginnt die Periode darin. Je regelmäßiger dein Zyklus, desto schmaler wird sie.',
          'Die Sicherheit (niedrig, mittel, hoch) hängt davon ab, wie viele Zyklen vorliegen und wie breit die Spanne ist.',
        ],
      },
      {
        title: 'Eisprung und fruchtbares Fenster',
        body: [
          'Der Eisprung liegt nicht bei allen an Tag 14. aya rechnet ihn deshalb vom erwarteten Beginn der nächsten Periode zurück: Die Lutealphase dauert im Mittel 12,4 Tage und schwankt deutlich weniger als die Zeit davor.',
          'Das fruchtbare Fenster umfasst die fünf Tage vor dem Eisprung und den Eisprungtag selbst, denn Spermien überleben bis zu fünf Tage.',
          'Trägst du Basaltemperatur oder LH-Tests ein, verfeinert aya den Eisprung damit. Ein Temperaturanstieg zählt nach der 3-über-6-Regel: drei Messungen über den sechs davor.',
        ],
      },
      {
        title: 'Vergessene Einträge',
        body: [
          'Ein Zyklus, der etwa doppelt so lang ist wie sonst, sieht oft nach einer nicht eingetragenen Periode aus. aya zählt ihn zunächst nicht mit und fragt nach.',
        ],
      },
      {
        title: 'Normbereiche',
        body: [
          'Als üblich gelten Zyklen von 24 bis 38 Tagen, Perioden bis 8 Tage und ein Unterschied von höchstens 7 bis 9 Tagen zwischen kürzestem und längstem Zyklus, je nach Alter. aya weist dich darauf hin, wenn deine Werte länger außerhalb liegen.',
        ],
      },
      {
        title: 'Wie genau aya bei dir ist',
        body: [
          'Ab drei Zyklen sagt aya deine vergangenen Zyklen nachträglich vorher, jeweils nur mit den Daten davor, und vergleicht mit dem echten Beginn. Das Ergebnis siehst du unter Muster.',
        ],
      },
    ],
    sourcesTitle: 'Quellen',
    sources: [
      { cite: 'Bull et al., npj Digital Medicine 2019', what: 'Zyklus- und Phasenlängen aus rund 600.000 Zyklen, Lutealphase im Mittel 12,4 Tage.' },
      { cite: 'Munro et al. (FIGO), Int. J. Gynecology & Obstetrics 2018', what: 'Normbereiche für Zykluslänge, Periodendauer und Regelmäßigkeit.' },
      { cite: 'Wilcox et al., New England Journal of Medicine 1995', what: 'Das fruchtbare Fenster: sechs Tage bis einschließlich Eisprung.' },
      { cite: 'Li et al., JAMIA 2022', what: 'Wie oft Einträge in Zyklus-Apps fehlen und wie man das erkennt.' },
    ],
    disclaimer: 'aya ist kein Verhütungsmittel und kein Medizinprodukt. Die Vorhersagen ersetzen keinen ärztlichen Rat.',
    learn: 'Mehr über den Zyklus',
  },
  learn: {
    title: 'Der Zyklus',
    intro: 'Was in deinem Körper in einem Zyklus passiert, verständlich erklärt.',
    phasesTitle: 'Die vier Phasen',
    phases: [
      {
        name: 'Menstruation',
        when: 'etwa Tag 1 bis 5',
        body: 'Ohne Schwangerschaft fallen Östrogen und Progesteron ab, und die Gebärmutter stößt ihre Schleimhaut ab. Krämpfe entstehen durch Prostaglandine, die die Muskulatur zusammenziehen. Wärme und leichte Bewegung lindern sie bei vielen.',
      },
      {
        name: 'Follikelphase',
        when: 'vom ersten Tag bis zum Eisprung',
        body: 'Das follikelstimulierende Hormon (FSH) lässt Eibläschen reifen. Das führende Bläschen bildet Östrogen, die Schleimhaut baut sich wieder auf. Diese Phase ist unterschiedlich lang und der Hauptgrund, warum Zyklen verschieden lang sind.',
      },
      {
        name: 'Eisprung',
        when: 'etwa 12 bis 14 Tage vor der nächsten Periode',
        body: 'Ein Anstieg des luteinisierenden Hormons (LH) löst den Eisprung aus. Die Eizelle ist danach etwa 12 bis 24 Stunden befruchtungsfähig. Der Zervixschleim wird klar und spinnbar, damit Spermien leichter durchkommen.',
      },
      {
        name: 'Lutealphase',
        when: 'vom Eisprung bis zur Periode',
        body: 'Aus dem leeren Bläschen wird der Gelbkörper und bildet Progesteron. Die Basaltemperatur steigt um etwa 0,2 bis 0,5 °C. In den Tagen vor der Periode sinken die Hormone wieder, was bei vielen zu PMS-Beschwerden führt.',
      },
    ],
    normalTitle: 'Was ist normal?',
    normal: [
      'Zykluslänge: 24 bis 38 Tage. Nur bei wenigen sind es genau 28.',
      'Periodendauer: bis 8 Tage.',
      'Schwankung: Liegen zwischen deinem kürzesten und längsten Zyklus höchstens 7 bis 9 Tage, je nach Alter, gilt dein Zyklus als regelmäßig.',
      'In den ersten Jahren nach der ersten Periode und in den Jahren vor den Wechseljahren schwankt der Zyklus oft stärker.',
    ],
    mythsTitle: 'Drei verbreitete Irrtümer',
    myths: [
      { myth: 'Der Eisprung ist an Tag 14.', fact: 'Nur bei einem Teil der Zyklen. Er hängt an der Länge deiner Follikelphase und verschiebt sich von Zyklus zu Zyklus.' },
      { myth: 'Während der Periode kann man nicht schwanger werden.', fact: 'Unwahrscheinlich, aber möglich, vor allem bei kurzen Zyklen, weil Spermien bis zu fünf Tage überleben.' },
      { myth: 'Eine App kann sicher verhüten.', fact: 'Kalenderrechnung allein ist keine sichere Verhütung. aya ist dafür nicht gemacht.' },
    ],
    signsTitle: 'Signale deines Körpers',
    signs: [
      { name: 'Basaltemperatur', body: 'Morgens vor dem Aufstehen gemessen, steigt sie nach dem Eisprung an und bleibt bis zur Periode erhöht. Sie bestätigt den Eisprung im Nachhinein.' },
      { name: 'LH-Test', body: 'Zeigt den LH-Anstieg 24 bis 36 Stunden vor dem Eisprung. Hilfreich bei Kinderwunsch.' },
      { name: 'Zervixschleim', body: 'Wird zum Eisprung hin wässrig und spinnbar wie rohes Eiweiß, danach wieder trockener.' },
    ],
  },
  theme: { label: 'Darstellung', system: 'System', light: 'Hell', dark: 'Dunkel' },
  disclaimer: 'aya ist kein Verhütungsmittel und kein Medizinprodukt.',
  tabs: { today: 'Heute', calendar: 'Kalender', insights: 'Muster', settings: 'Einstellungen' },
  emptyToday: {
    title: 'Noch keine Periode eingetragen',
    body: 'Trag den ersten Tag deiner Periode ein. Danach zeigt dir aya, wann die nächste wahrscheinlich kommt.',
    import: 'Alte Daten importieren',
    importHint: 'Aus Apple Health, Flo oder einer CSV-Datei.',
    ring: 'Dein Zyklus erscheint hier, sobald du eine Periode einträgst.',
    ringCaption: 'noch keine Daten',
  },
  loadError: 'aya konnte deine Daten nicht öffnen. Schließ die App und öffne sie noch einmal.',
  loadErrorBrowser:
    'Im Safari-Tab und in der App auf dem Home-Bildschirm hat aya getrennte Speicher. Deine Daten in der App sind davon nicht betroffen. Nutze aya am besten nur über das Icon auf dem Home-Bildschirm.',
  loadErrorCode: (code: string) => `Fehlercode: ${code}`,
  loadErrorReset: 'In diesem Browser neu beginnen',
  onboarding: {
    step: (n: number, of: number) => `Schritt ${n} von ${of}`,
    next: 'Weiter',
    back: 'Zurück',
    skip: 'Überspringen',
    finish: 'Los geht’s',
    protect: {
      title: 'Wie soll aya deine Daten schützen?',
      body: 'Verschlüsselt sind deine Daten in beiden Fällen. Du entscheidest, was zum Öffnen nötig ist. Das lässt sich später in den Einstellungen ändern.',
      device: { label: 'Mit diesem iPhone', hint: 'Bequem und ohne Passwort. Der Schlüssel bleibt auf diesem Gerät. Eine PIN kannst du später dazunehmen.' },
      passphrase: { label: 'Mit einer Passphrase', hint: 'Am sichersten. Ohne Passphrase oder Wiederherstellungscode kommt niemand an deine Einträge, auch nicht mit deinem entsperrten iPhone.' },
      field: 'Passphrase',
      fieldHint: 'Mindestens 4 Wörter oder 16 Zeichen. Ein kurzer Satz, den nur du kennst, ist ideal.',
      repeat: 'Noch einmal eingeben',
      weak: 'Die Passphrase ist zu kurz. Nimm mindestens 4 Wörter oder 16 Zeichen.',
      mismatch: 'Die beiden Eingaben stimmen nicht überein.',
      working: 'Schlüssel wird erzeugt …',
    },
    recovery: {
      title: 'Dein Wiederherstellungscode',
      body: 'Wenn du deine Passphrase vergisst, kommst du nur mit diesem Code wieder an deine Daten. aya zeigt ihn nur dieses eine Mal. Schreib ihn auf Papier und bewahre ihn getrennt vom iPhone auf.',
      copy: 'Kopieren',
      copied: 'Kopiert. Lösch ihn aus der Zwischenablage, sobald er notiert ist.',
      confirm: 'Ich habe den Code notiert.',
    },
    welcome: {
      title: 'Deine Daten bleiben bei dir',
      points: [
        'Kein Konto, kein Server, keine Cloud.',
        'Alles wird verschlüsselt auf diesem Gerät gespeichert.',
        'aya sendet nichts ins Internet. Nie.',
      ],
      homeScreen:
        'Tipp: Tippe in Safari auf Teilen und dann auf „Zum Home-Bildschirm“. Nur so bleiben deine Daten dauerhaft erhalten.',
    },
    period: {
      title: 'Wann hat deine letzte Periode begonnen?',
      body: 'Ungefähr reicht. Du kannst das auch überspringen und später eintragen.',
      startLabel: 'Erster Tag',
      cycleLabel: 'Zykluslänge',
      periodLabel: 'Periodendauer',
      unknown: 'Weiß ich nicht',
      days: (n: number) => (n === 1 ? '1 Tag' : `${n} Tage`),
      decrease: (label: string) => `${label} verringern`,
      increase: (label: string) => `${label} erhöhen`,
      choose: (label: string) => `${label} auswählen`,
    },
    mode: {
      title: 'Wofür möchtest du aya nutzen?',
      options: {
        track: { label: 'Zyklus verfolgen', hint: 'Periode, Symptome und Vorhersagen.' },
        conceive: { label: 'Kinderwunsch', hint: 'Fruchtbare Tage stehen im Vordergrund.' },
        hormonal_contraception: { label: 'Hormonelle Verhütung', hint: 'Blutungen und Symptome, ohne Eisprung-Vorhersage.' },
      },
    },
    note: {
      title: 'Bevor es losgeht',
      body: 'Die Vorhersagen beruhen auf Statistik und zeigen immer eine Spanne. Sie ersetzen weder Verhütung noch ärztlichen Rat.',
      pin: 'Wenn du möchtest, kannst du später in den Einstellungen eine PIN festlegen.',
    },
  },
  doctor: {
    title: 'Wann du zur Ärztin gehen solltest',
    body: 'aya hilft dir, deinen Zyklus zu verstehen. Für eine ernsthafte Beratung ist eine Frauenärztin oder ein Frauenarzt da: bei starken Schmerzen, sehr starken oder ausbleibenden Blutungen, bei Fragen zur Verhütung, nach einem positiven Schwangerschaftstest und wenn ein Kinderwunsch länger als ein Jahr unerfüllt bleibt.',
    links: [
      { label: 'Termin über Doctolib finden', href: 'https://www.doctolib.de/frauenarzt' },
      { label: 'Arztsuche der Kassenärztlichen Vereinigungen (116117)', href: 'https://arztsuche.116117.de/' },
    ],
    urgent: 'Außerhalb der Sprechzeiten: ärztlicher Bereitschaftsdienst 116 117. Im Notfall 112.',
    opens: 'öffnet im Browser',
  },
  lock: {
    passphraseTitle: 'aya ist gesperrt',
    passphraseLabel: 'Passphrase oder Wiederherstellungscode',
    passphraseWrong: 'Das passt nicht. Prüf die Schreibweise oder nimm deinen Wiederherstellungscode.',
    unlock: 'Entsperren',
    unlocking: 'Wird entsperrt …',
    title: 'Gib deine PIN ein',
    wrong: 'Diese PIN stimmt nicht.',
    wait: (s: number) => `Zu viele Versuche. Bitte warte noch ${s} Sekunden.`,
    delete: 'Letzte Ziffer löschen',
    entered: (n: number, of: number) => `${n} von ${of} Ziffern eingegeben`,
  },
  settings: {
    title: 'Einstellungen',
    lockSection: 'Datenschutz',
    protection: 'Schutzart',
    protectionHow: 'Wie sich aya öffnet',
    protectionDevice: 'Dieses iPhone',
    protectionPassphrase: 'Passphrase',
    protectionDeviceHint: 'Deine Daten sind mit einem Schlüssel verschlüsselt, der dieses Gerät nie verlässt. Die PIN schützt zusätzlich vor neugierigen Blicken.',
    protectionPassphraseHint: 'Deine Daten öffnen sich nur mit deiner Passphrase oder dem Wiederherstellungscode. aya sperrt sich automatisch.',
    toDeviceIntro: 'Danach öffnet sich aya ohne Passphrase. Dein Wiederherstellungscode gilt nicht mehr.',
    changePassphrase: 'Passphrase ändern',
    newRecovery: 'Neuen Wiederherstellungscode erzeugen',
    newRecoveryIntro: 'Der alte Code gilt danach nicht mehr.',
    currentPassphrase: 'Aktuelle Passphrase',
    newPassphrase: 'Neue Passphrase',
    confirmAction: 'Bestätigen',
    protectionDone: 'Geändert.',
    backupFirst: 'Erstelle vorher ein Backup. So bleiben deine Daten sicher, falls beim Wechsel etwas schiefgeht.',
    pin: 'PIN',
    pinOn: 'An',
    pinOff: 'Aus',
    setPin: 'PIN festlegen',
    changePin: 'PIN ändern',
    removePin: 'PIN entfernen',
    currentPin: 'Aktuelle PIN eingeben',
    pinHint: 'Die PIN schützt vor neugierigen Blicken. Sie ersetzt nicht die Sperre deines iPhones.',
    newPin: 'Neue PIN eingeben',
    confirmPin: 'PIN wiederholen',
    mismatch: 'Die PINs stimmen nicht überein. Versuch es noch einmal.',
    cancel: 'Abbrechen',
    autoLock: 'Automatisch sperren nach',
    minutes: (n: number) => (n === 1 ? '1 Minute' : `${n} Minuten`),
    autoLockHint: 'Und immer, wenn aya länger als eine Minute im Hintergrund war.',
    shield: 'Sichtschutz',
    shieldHint: 'Deckt aya ab, wenn du die App 15 Sekunden nicht bedienst oder verlässt. Ein Tipp zeigt sie wieder. So zeigt meist auch der App-Umschalter nichts Lesbares. Ganz zuverlässig geht das bei Web-Apps leider nicht, weil iOS das Vorschaubild sehr früh aufnimmt.',
    shieldTap: 'Tippen zum Anzeigen',
    aboutSection: 'Über aya',
    generalSection: 'Allgemein',
    mode: 'Modus',
    birthYear: 'Geburtsjahr',
    birthYearHint: 'Freiwillig. Nur für die altersabhängige Einordnung der Regelmäßigkeit.',
    birthYearNone: 'keine Angabe',
    themeLabel: 'Darstellung',
    dataSection: 'Deine Daten',
    backup: 'Backup erstellen',
    backupLast: (date: string) => `Letztes Backup: ${date}`,
    backupNever: 'Noch kein Backup erstellt.',
    backupIntro:
      'Das Backup ist eine verschlüsselte Datei. Wähle ein Passwort dafür. Ohne dieses Passwort lässt sich das Backup nicht öffnen, auch nicht von dir.',
    password: 'Passwort',
    passwordRepeat: 'Passwort wiederholen',
    passwordShort: 'Bitte mindestens 8 Zeichen.',
    passwordMismatch: 'Die Passwörter stimmen nicht überein.',
    backupCreate: 'Backup speichern',
    working: 'Einen Moment …',
    backupDone: 'Backup erstellt. Bewahre die Datei und das Passwort gut auf.',
    restore: 'Backup laden',
    restoreIntro: 'Dein aktueller Stand auf diesem Gerät wird durch das Backup ersetzt.',
    restoreFile: 'Backup-Datei',
    restoreStart: 'Backup laden',
    restoreDone: (n: number) => `Backup geladen: ${n} Tage.`,
    restoreErrors: {
      invalid_file: 'Diese Datei ist kein aya-Backup.',
      unsupported_version: 'Dieses Backup stammt aus einer neueren Version von aya.',
      wrong_password: 'Das Passwort passt nicht zu diesem Backup.',
    },
    importData: 'Daten importieren',
    importIntro: 'Übernimm Einträge aus einer anderen App: Apple-Health-Export (export.zip oder export.xml), CSV oder JSON, zum Beispiel aus Flo. Die Datei wird nur hier auf dem Gerät gelesen.',
    importFile: 'Datei',
    importReading: 'Datei wird gelesen …',
    importFound: (days: number, period: number) => `${days} Tage gefunden, davon ${period} mit Periode.`,
    importSources: 'Aus diesen Apps:',
    importSourceCount: (n: number) => (n === 1 ? '1 Eintrag' : `${n} Einträge`),
    importList: 'Liste in der Datei',
    importDate: 'Datum oder Periodenbeginn',
    importDateFormat: 'Datumsformat',
    importDateFormats: { iso: '2026-10-16', de: '16.10.2026', us: '10/16/2026', unix: 'Zeitstempel' },
    importEnd: 'Periodenende',
    importFlow: 'Blutungsstärke',
    importSymptoms: 'Symptome',
    importNone: '– keine –',
    importNoFlowHint: 'Ohne Spalte für die Stärke zählt jede Zeile als Tag mit mittlerer Blutung.',
    importPreview: 'Vorschau',
    importErrors: (n: number) => (n === 1 ? '1 Zeile ist nicht lesbar und wird übersprungen.' : `${n} Zeilen sind nicht lesbar und werden übersprungen.`),
    importNoDates: 'In dieser Datei hat aya keine Datumsangaben gefunden.',
    importUnknown: {
      empty: 'Die Datei ist leer.',
      'zip-without-health': 'In diesem ZIP liegt kein Apple-Health-Export (export.xml).',
      unreadable: 'Diese Datei kann aya nicht lesen. Probier eine CSV-, JSON- oder Apple-Health-Datei.',
    },
    importKeep: 'Deine bisherigen Einträge bleiben erhalten. Am selben Tag gewinnen die importierten Angaben.',
    importStart: 'Importieren',
    importDone: (n: number) => `Importiert: ${n} ${n === 1 ? 'Tag' : 'Tage'}.`,
    csvExport: 'Als CSV exportieren',
    csvIntro: 'Die CSV-Datei ist nicht verschlüsselt. Jede Person und jede App, die sie öffnet, kann deine Einträge lesen. Für eine Sicherung nimm lieber das Backup.',
    csvCreate: 'CSV-Datei speichern',
    csvDone: 'CSV-Datei erstellt.',
    ics: 'Kalender-Export',
    icsIntro:
      'aya kann ohne Server keine Erinnerungen schicken. Exportiere stattdessen die erwarteten Periodentage in deinen Kalender. Der Termintitel ist neutral und frei wählbar.',
    icsTitle: 'Termintitel',
    icsCreate: 'Termine exportieren',
    icsNone: 'Für einen Export braucht aya mindestens eine eingetragene Periode.',
    icsDone: 'Kalenderdatei erstellt. Öffne sie, um die Termine zu übernehmen.',
    deleteAll: 'Alle Daten löschen',
    deleteIntro:
      'Alle Einträge, Einstellungen und der Schlüssel auf diesem Gerät werden unwiderruflich gelöscht. Ohne Backup gibt es keinen Weg zurück.',
    deleteConfirmLabel: 'Tippe LÖSCHEN zur Bestätigung',
    deleteWord: 'LÖSCHEN',
    deleteButton: 'Unwiderruflich löschen',
    methodology: 'Methodik und Quellen',
    privacy: 'aya speichert alles verschlüsselt auf diesem Gerät und stellt keine Verbindung ins Internet her.',
    privacyLink: 'Datenschutz und Sicherheit',
    imprintLink: 'Impressum',
  },
} as const;
