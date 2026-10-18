---
version: 1
slug: "src-ui-screens-today-tsx"
primary_target: "src/ui/screens/Today.tsx"
related_targets: ["src/ui/theme/tokens.css"]
---

# Surface: Heute (and app shell)

Scope: the aya app shell and Heute screen; establishes the visual world for every later screen. Mode: Operate.
Audience/job: casual iPhone users check where they are in the cycle and log a day in under 10 seconds, often in the evening.
Constraints: system fonts only (zero network), WCAG AA, ≥ 44 px targets, reduced motion, light and dark both complete, colour never the only signal.

## Direction contract

THESIS: The cycle read like a star chart: every day a point on a ring, its size carrying meaning, the forecast drawn as faint unlit points with an honest range. Refuses the category default of a pink gradient disc with cards beneath.
OWN-WORLD: Deep navy chart ground (dark) or pale cool chart paper (light), chalk ink, one night-vision amber reserved for "today" and ovulation, rosé/turquoise/violet as phase inks. Serif italic (system New York) names states, system sans and tabular figures do the work. Hairline coordinate rules, no cards, no shadows, no gradients.
STORY: She sees her day and the next period at once, trusts the range because it is shown as a spread, and logs with one tap.
FIRST VIEWPORT: Top: wordmark and date. Then the statement in large serif italic ("Periode in 5 Tagen") with range and confidence below in sans. Centre: the ring, ~300 px, day dots on a hairline orbit, today ringed amber, cycle day in the centre. Below: primary button "Periode begonnen", secondary "Heute eintragen". Bottom tab bar.
FORM: Star atlas (challenger notation-diagram-systems-star-atlas), chosen over the assigned Almanach. seed:c87b30feed0a6fa8
SIGNATURE: Dot diameter on a fixed magnitude ramp encodes flow (spotting → heavy); predicted days are hollow; on first render the dots light up in day order like stars appearing (off under reduced motion).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
