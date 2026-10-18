// Zero-network gate: fails if app source or build output contains network APIs,
// external URLs, or a weakened CSP. Run after `npm run build` to also check dist/.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface Finding {
  file: string;
  line: number;
  rule: string;
  excerpt: string;
}

// Allowlist: SVG/XML namespaces and inert URLs inside library error messages (never requested;
// connect-src 'none' would block them anyway).
const RULES: { name: string; pattern: RegExp }[] = [
  { name: 'fetch', pattern: /\bfetch\s*\(/ },
  { name: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
  { name: 'WebSocket', pattern: /\bWebSocket\b/ },
  { name: 'EventSource', pattern: /\bEventSource\b/ },
  { name: 'sendBeacon', pattern: /\bsendBeacon\b/ },
  { name: 'RTCPeerConnection', pattern: /\bRTCPeerConnection\b/ },
  { name: 'external-url', pattern: /\b(?:https?:|wss?:)\/\/(?!(?:www\.w3\.org|react\.dev\/errors|bit\.ly\/wb-precache|docs\.github\.com\/de\/site-policy)\b)[^\s'"`)]+/ },
];

// Build output from third-party code (React, Workbox) mentions these names without using
// them for our data; we only scan dist for external URLs and the CSP.
const DIST_RULES = new Set(['external-url']);

const TEXT_EXT = /\.(ts|tsx|js|mjs|css|html|webmanifest|json|svg)$/;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : TEXT_EXT.test(name) ? [path] : [];
  });
}

export function scanText(file: string, text: string, rules = RULES): Finding[] {
  const findings: Finding[] = [];
  text.split('\n').forEach((lineText, i) => {
    for (const rule of rules) {
      const match = rule.pattern.exec(lineText);
      if (match) {
        const start = Math.max(0, match.index - 30);
        findings.push({ file, line: i + 1, rule: rule.name, excerpt: lineText.slice(start, start + 100).trim() });
      }
    }
  });
  return findings;
}

export function checkCsp(html: string): string[] {
  const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1];
  if (!csp) return ['CSP meta tag missing'];
  const problems: string[] = [];
  if (!/connect-src 'none'/.test(csp)) problems.push("CSP must contain connect-src 'none'");
  if (!/default-src 'self'/.test(csp)) problems.push("CSP must contain default-src 'self'");
  if (/unsafe-eval/.test(csp)) problems.push('CSP must not allow unsafe-eval');
  return problems;
}

function main(): void {
  const root = process.cwd();
  const isTest = (f: string) => /\.test\.tsx?$/.test(f);
  const srcFiles = walk(join(root, 'src')).filter((f) => !isTest(f));
  const distFiles = walk(join(root, 'dist'));
  const distRules = RULES.filter((r) => DIST_RULES.has(r.name));

  const findings = [
    ...srcFiles.flatMap((f) => scanText(relative(root, f), readFileSync(f, 'utf8'))),
    ...distFiles.flatMap((f) => scanText(relative(root, f), readFileSync(f, 'utf8'), distRules)),
  ];

  const cspProblems = checkCsp(readFileSync(join(root, 'index.html'), 'utf8'));
  const distIndex = join(root, 'dist', 'index.html');
  if (existsSync(distIndex)) cspProblems.push(...checkCsp(readFileSync(distIndex, 'utf8')).map((p) => `dist: ${p}`));

  for (const f of findings) console.error(`✗ ${f.file}:${f.line} [${f.rule}] ${f.excerpt}`);
  for (const p of cspProblems) console.error(`✗ ${p}`);

  const scanned = `${srcFiles.length} source files, ${distFiles.length} build files`;
  if (findings.length || cspProblems.length) {
    console.error(`privacy-check failed (${scanned})`);
    process.exit(1);
  }
  if (!distFiles.length) console.warn('note: dist/ not found, run `npm run build` to check build output too');
  console.log(`✓ privacy-check passed (${scanned})`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
