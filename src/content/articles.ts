import type { ISODate } from '../engine/dates.ts';

/**
 * Knowledge articles for the Wissen tab. They ship with the app (aya loads nothing from the
 * internet), so new ones arrive with an update; `added` drives the "Neu" shelf. Facts carry their
 * source in `sources` so they can be checked. "Der Zyklus" has its own layout (Learn) and is listed
 * here only for the shelf.
 */

export type Category = 'basics' | 'health' | 'everyday' | 'tips';

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'tip'; text: string };

export interface Article {
  id: string;
  category: Category;
  title: string;
  teaser: string;
  added: ISODate;
  minutes: number;
  blocks: Block[];
  sources?: string[];
}

export const CATEGORY_LABEL: Record<Category, string> = {
  basics: 'Grundlagen',
  health: 'Gesundheit',
  everyday: 'Alltag',
  tips: 'Empfehlungen',
};

/** Articles count as new for this many days after `added`. */
export const NEW_DAYS = 30;

export const CYCLE_ARTICLE_ID = 'zyklus';

export const ARTICLES: Article[] = [
  {
    id: CYCLE_ARTICLE_ID,
    category: 'basics',
    title: 'Der Zyklus',
    teaser: 'Die vier Phasen, was normal ist und welche Signale dein Körper sendet.',
    added: '2026-10-19',
    minutes: 4,
    blocks: [],
  },
  {
    id: 'regelschmerzen',
    category: 'health',
    title: 'Regelschmerzen: Was wirklich hilft',
    teaser: 'Warum die Periode wehtut, was gut belegt hilft und wann du es abklären lassen solltest.',
    added: '2026-10-20',
    minutes: 3,
    blocks: [
      { type: 'p', text: 'Krämpfe in den ersten Tagen der Periode sind häufig. Sie entstehen durch Prostaglandine: Botenstoffe, die die Gebärmutter zusammenziehen lassen, damit sich die Schleimhaut löst. Je mehr davon, desto stärker die Schmerzen.' },
      { type: 'h', text: 'Was gut belegt hilft' },
      {
        type: 'list',
        items: [
          'Schmerzmittel wie Ibuprofen oder Naproxen bremsen die Bildung der Prostaglandine. Sie wirken am besten, wenn du sie früh nimmst, sobald die Schmerzen beginnen.',
          'Wärme auf dem Unterbauch, etwa eine Wärmflasche, lindert in Studien ähnlich gut wie ein leichtes Schmerzmittel.',
          'Regelmäßige Bewegung über den ganzen Zyklus kann die Schmerzen verringern.',
          'Hormonelle Verhütung macht die Periode bei vielen schwächer und weniger schmerzhaft. Das besprichst du mit deiner Ärztin.',
        ],
      },
      { type: 'h', text: 'Wann du es abklären lassen solltest' },
      {
        type: 'list',
        items: [
          'Die Schmerzen werden mit den Jahren stärker oder Schmerzmittel helfen kaum.',
          'Du hast auch außerhalb der Periode Schmerzen im Unterbauch, beim Sex oder beim Stuhlgang.',
          'Du fehlst wegen der Schmerzen regelmäßig in Schule, Uni oder Arbeit.',
        ],
      },
      { type: 'tip', text: 'Starke Regelschmerzen können ein Hinweis auf Endometriose sein. Bis zur Diagnose vergehen oft mehrere Jahre. Deine Einträge in aya und die Druckübersicht unter Muster helfen beim Arztgespräch.' },
    ],
    sources: [
      'Marjoribanks et al., Cochrane Database of Systematic Reviews 2015: NSAR bei primärer Dysmenorrhoe.',
      'Akin et al., Obstetrics & Gynecology 2001: Wärmetherapie im Vergleich zu Ibuprofen.',
      'AWMF-Leitlinie Endometriose (S2k), 2020.',
    ],
  },
  {
    id: 'pms',
    category: 'health',
    title: 'PMS und PMDS',
    teaser: 'Beschwerden vor der Periode: wie häufig sie sind und wann sie mehr als lästig sind.',
    added: '2026-10-20',
    minutes: 3,
    blocks: [
      { type: 'p', text: 'Das prämenstruelle Syndrom (PMS) umfasst Beschwerden in den Tagen vor der Periode: Reizbarkeit, gedrückte Stimmung, Brustspannen, Blähungen, Heißhunger oder Müdigkeit. Typisch ist, dass sie mit dem Beginn der Blutung nachlassen.' },
      { type: 'p', text: 'Viele kennen leichte Formen davon. Als prämenstruelle dysphorische Störung (PMDS) gilt eine schwere Form, bei der vor allem die Stimmung so stark leidet, dass Alltag und Beziehungen darunter leiden. Das betrifft etwa 3 bis 8 von 100 Menstruierenden.' },
      { type: 'h', text: 'Was helfen kann' },
      {
        type: 'list',
        items: [
          'Beschwerden über zwei Zyklen festhalten. Das zeigt, ob sie wirklich an die zweite Zyklushälfte gebunden sind, und ist die Grundlage für eine Diagnose.',
          'Bewegung, genug Schlaf und feste Routinen tun vielen gut.',
          'Bei PMDS gibt es wirksame Behandlungen, etwa bestimmte Antidepressiva oder hormonelle Ansätze. Sprich mit deiner Ärztin darüber.',
        ],
      },
      { type: 'tip', text: 'Trag Stimmung und Symptome in aya ein. Nach drei Zyklen zeigt dir Muster, ob sie sich in bestimmten Phasen häufen.' },
    ],
    sources: [
      'Yonkers et al., The Lancet 2008: Premenstrual syndrome.',
      'DSM-5: Kriterien der prämenstruellen dysphorischen Störung.',
    ],
  },
  {
    id: 'basaltemperatur',
    category: 'everyday',
    title: 'Basaltemperatur richtig messen',
    teaser: 'So wird deine Kurve aussagekräftig, und das bringt sie dir.',
    added: '2026-10-20',
    minutes: 2,
    blocks: [
      { type: 'p', text: 'Nach dem Eisprung steigt die Körpertemperatur in Ruhe durch das Progesteron um etwa 0,2 bis 0,5 °C und bleibt bis zur Periode erhöht. Die Kurve zeigt so im Nachhinein, ob und wann ein Eisprung war.' },
      { type: 'h', text: 'So misst du' },
      {
        type: 'list',
        items: [
          'Morgens direkt nach dem Aufwachen, vor dem Aufstehen, nach mindestens drei Stunden Schlaf.',
          'Jeden Tag ungefähr zur gleichen Uhrzeit und immer an der gleichen Stelle, zum Beispiel im Mund.',
          'Mit einem digitalen Thermometer, das zwei Nachkommastellen anzeigt.',
        ],
      },
      { type: 'h', text: 'Was die Messung stört' },
      { type: 'p', text: 'Alkohol am Abend, eine kurze oder unruhige Nacht, Krankheit, Reisen und Zeitverschiebung. Markiere solche Messungen in aya als gestört, dann zählen sie nicht mit.' },
      { type: 'tip', text: 'Die Temperatur allein sagt den Eisprung nicht vorher, sie bestätigt ihn. Zusammen mit LH-Tests und Zervixschleim wird das Bild genauer.' },
    ],
  },
  {
    id: 'sport',
    category: 'everyday',
    title: 'Zyklus und Sport',
    teaser: 'Sollte man nach Zyklusphase trainieren? Was die Forschung dazu sagt.',
    added: '2026-10-20',
    minutes: 2,
    blocks: [
      { type: 'p', text: 'Zyklusbasiertes Training ist ein großer Trend. Die Studienlage ist aber dünner, als viele Ratgeber vermuten lassen. Eine große Auswertung vieler Studien fand nur einen sehr kleinen Leistungsunterschied, am ehesten in den Tagen der Periode, und bewertete die Qualität der Studien überwiegend als niedrig.' },
      { type: 'p', text: 'Die Forschenden empfehlen deshalb keinen festen Plan für alle, sondern einen persönlichen Ansatz: Achte darauf, wie du dich in welcher Phase fühlst, und passe das Training daran an.' },
      { type: 'tip', text: 'Trag ein paar Zyklen lang deine Energie in aya ein. So siehst du, ob es bei dir ein Muster gibt, statt dich nach einem allgemeinen Plan zu richten.' },
    ],
    sources: ['McNulty et al., Sports Medicine 2020: Menstruationszyklus und sportliche Leistung, Meta-Analyse.'],
  },
  {
    id: 'quellen',
    category: 'tips',
    title: 'Gute Quellen zum Weiterlesen',
    teaser: 'Verlässliche, werbefreie Seiten zu Zyklus und Frauengesundheit.',
    added: '2026-10-20',
    minutes: 1,
    blocks: [
      { type: 'p', text: 'Im Netz kursiert viel Halbwissen. Diese Angebote sind unabhängig oder werden von Fachgesellschaften getragen:' },
      {
        type: 'list',
        items: [
          'gesundheitsinformation.de: vom Institut für Qualität und Wirtschaftlichkeit im Gesundheitswesen (IQWiG), geprüft und ohne Werbung.',
          'frauenaerzte-im-netz.de: von den Berufsverbänden der Frauenärztinnen und Frauenärzte.',
          'endometriose-vereinigung.de: Selbsthilfe und Informationen zu Endometriose.',
          'familienplanung.de: von der staatlichen Gesundheitsaufklärung, zu Verhütung und Kinderwunsch.',
        ],
      },
      { type: 'tip', text: 'Tipp: Gib die Adresse selbst in Safari ein. aya öffnet von sich aus keine Seiten.' },
    ],
  },
];

export function articleById(id: string): Article | undefined {
  return ARTICLES.find((a) => a.id === id);
}

export function isNew(a: Article, today: ISODate): boolean {
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${a.added}T00:00:00Z`)) / 86_400_000;
  return days >= 0 && days < NEW_DAYS;
}
