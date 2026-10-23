/**
 * Every external address aya links to, in one place. They only open in the browser when tapped
 * (new tab, no referrer) and never carry data. scripts/privacy-check.ts allows exactly these
 * addresses and fails on any other, so a new link has to be added here first.
 */
export const LINKS = {
  doctolib: 'https://www.doctolib.de/frauenarzt',
  arztsuche: 'https://arztsuche.116117.de/',
  gesundheitsinformation: 'https://www.gesundheitsinformation.de/',
  frauenaerzte: 'https://www.frauenaerzte-im-netz.de/',
  endometriose: 'https://www.endometriose-vereinigung.de/',
  familienplanung: 'https://www.familienplanung.de/',
  source: 'https://github.com/KonnorVibe/aya',
} as const;

export const ALLOWED_LINKS: readonly string[] = Object.values(LINKS);
