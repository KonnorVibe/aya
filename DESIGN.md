> **aya 1.0:** Layout, Ring und Komponenten folgen diesem Dokument (Sternatlas). Die Farben kommen aus der Palette „Pflanzenfarben“ von vergleichskillweb (Leinen hell, Violett-Schwarz dunkel, Indigo als einziger Akzent statt Bernstein), Werte in `src/ui/theme/tokens.css`.

---
name: aya
description: Cycle tracking read like a star chart, private on the device.
colors:
  chart-paper: "#eef0f8"
  chart-paper-raised: "#e3e6f2"
  chalk-ink-day: "#151b38"
  ink-muted-day: "#47507a"
  rule-day: "#151b3826"
  rule-strong-day: "#151b3859"
  period-rose-day: "#b03f57"
  fertile-turquoise-day: "#0f7a73"
  luteal-violet-day: "#6650a8"
  signal-amber-day: "#9e5405"
  idle-point-day: "#151b388c"
  night-chart: "#10152e"
  night-chart-raised: "#182042"
  chalk-ink-night: "#eceaf4"
  ink-muted-night: "#a9acc8"
  rule-night: "#eceaf41f"
  rule-strong-night: "#eceaf447"
  period-rose-night: "#c86a80"
  fertile-turquoise-night: "#4cc3ba"
  luteal-violet-night: "#a796e0"
  signal-amber-night: "#f0a54a"
  idle-point-night: "#eceaf466"
typography:
  display:
    fontFamily: "ui-serif, 'New York', Georgia, 'Times New Roman', serif"
    fontSize: "56px"
    fontWeight: 400
    lineHeight: 1
  headline:
    fontFamily: "ui-serif, 'New York', Georgia, 'Times New Roman', serif"
    fontSize: "2.25rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "ui-serif, 'New York', Georgia, 'Times New Roman', serif"
    fontSize: "1.375rem"
    fontWeight: 400
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    fontFeature: "tnum"
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    fontFeature: "tnum"
  chart-name:
    fontFamily: "ui-serif, 'New York', Georgia, 'Times New Roman', serif"
    fontSize: "12px"
    fontWeight: 400
rounded:
  control: "6px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  gutter: "20px"
  target: "44px"
components:
  button-primary:
    backgroundColor: "color-mix(in srgb, {colors.period-rose-night} 14%, transparent)"
    textColor: "{colors.chalk-ink-night}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "color-mix(in srgb, {colors.period-rose-night} 24%, transparent)"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.chalk-ink-night}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "52px"
  button-secondary-hover:
    backgroundColor: "{colors.night-chart-raised}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted-night}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.chalk-ink-night}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  chip-selected-period:
    backgroundColor: "color-mix(in srgb, {colors.period-rose-night} 16%, transparent)"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted-night}"
    height: "52px"
  tab-active:
    textColor: "{colors.chalk-ink-night}"
---

# Design System: aya

## Overview

**Creative North Star: "The Star Atlas"**

aya reads the cycle the way an astronomer reads a chart: every day is a point on a hairline orbit, its size carries meaning, and the forecast is drawn as faint unlit points inside an honest, dashed range. The ground is a deep navy night chart in dark mode and pale cool chart paper in light mode; both are complete worlds, not inversions of each other. Ink is chalk-pale on night, deep navy on day.

The system is quiet and exact. Hairline coordinate rules divide the page instead of cards; there are no shadows and no gradients, and depth is never simulated. A serif italic names things (the statement, the wordmark, the cycle day, the phase names on the chart); the system sans with tabular figures does the work (dates, ranges, confidence, buttons). One night-vision amber is held back for "today" and ovulation so the eye always finds now.

The pull is toward the category's opposite: no pink gradient disc, no stack of cards, no decoration. Meaning is carried by position, magnitude, written names and fill, so colour is never the only signal.

**Key Characteristics:**
- Two full chart grounds (night and day), switched by `prefers-color-scheme` or an explicit `data-theme`.
- Hairline rules and graticule ticks instead of containers.
- Serif italic for names, system sans with tabular figures for data.
- Amber reserved for today and ovulation; phase inks (rose, turquoise, violet) carry the cycle.
- Fixed magnitude ramp: dot size encodes flow; forecast points are hollow.
- System fonts only, zero network.

## Colors

A cool navy chart with chalk ink and three muted phase inks, punctuated by a single amber signal. Every role has a day value and a night value; tokens are named per ground, and code consumes them through the role variables in `src/ui/theme/tokens.css` (`--ground`, `--ink`, `--period`, ...).

### Primary
- **Period Rose** (period-rose-day / period-rose-night): the period phase on the ring, the flow ramp, the dashed next-period range and its dated ticks, and the frame of the primary action. Muted rose, never candy pink. `--period-ink` (white on day, night navy on night) is its on-colour for any solid fill.

### Secondary
- **Fertile Turquoise** (fertile-turquoise-day / fertile-turquoise-night): fertile window and peak days on the ring, the fertile chip tone, the "fruchtbar" chart name.
- **Luteal Violet** (luteal-violet-day / luteal-violet-night): luteal phase points and name, the forecast swatch in the legend, and the text-selection wash (30% mix).

### Tertiary
- **Signal Amber** (signal-amber-day / signal-amber-night): the reticle around today's point, the ovulation point, and the stroke of the active tab icon. Nothing else.

### Neutral
- **Night Chart / Chart Paper** (night-chart, chart-paper): the page ground. Also the fill of hollow forecast points, so they read as unlit.
- **Raised Ground** (night-chart-raised, chart-paper-raised): hover fill for secondary controls; the only tonal step above ground.
- **Chalk Ink** (chalk-ink-night, chalk-ink-day): text, the cycle day numeral, button labels, focus outline and caret.
- **Muted Ink** (ink-muted-night, ink-muted-day): dates, range and confidence lines, captions, legend, inactive tabs, quiet buttons.
- **Rule** and **Rule Strong** (rule-*, rule-strong-*): ink at roughly 12-15% and 28-35% alpha. Rule draws the orbit, the header underline and the tab-bar top edge; Rule Strong draws week ticks, secondary button and chip frames, and link underlines.
- **Idle Point** (idle-point-*): follicular and unclassified days on the ring.

### Named Rules
**The Night-Vision Rule.** Amber marks today and ovulation, plus the active tab icon that leads to today. If anything else on the screen is amber, it is wrong.

**The Never-Only-Colour Rule.** Every colour-coded meaning has a second channel: phase names written on the ring, a legend for forecast and the flow ramp, hollow versus filled points, a check mark plus fill on selected chips.

**The Ink-Focus Rule.** Focus outlines and the caret use ink, never a phase colour, so focus never reads as data.

## Typography

**Display / Name Font:** system serif, ui-serif / New York (with Georgia, Times New Roman)
**Body / UI Font:** system sans, -apple-system / SF (with system-ui, Segoe UI)

**Character:** The serif italic is the voice of the chart, setting names and states as an atlas sets star names; the sans is the instrument readout. Fonts are pinned to system faces by the zero-network brief: no webfonts, ever.

### Hierarchy
- **Display** (serif italic 400, 56px in the ring's SVG): the cycle day numeral at the centre of the ring.
- **Headline** (serif italic 400, 2.25rem, line-height 1.1, -0.01em): the day's statement ("Periode in 5 Tagen"); balanced wrapping.
- **Title** (serif italic 400, 1.375rem): the lowercase "aya" wordmark.
- **Body** (sans 400, 1.0625rem, line-height 1.45, tabular figures): range and confidence lines, button labels (600 primary, 500 secondary).
- **Label** (sans 400, 0.875rem): header date, chip text.
- **Caption** (sans 400, 0.75rem): legend; chart annotations in SVG run 11-12px (range dates, cycle-day caption, tab labels at 11px).
- **Chart Name** (serif italic 400, 12px): phase names set beside their run of points.

### Named Rules
**The Names-And-Numbers Rule.** Serif italic names a state; sans with tabular figures reports a value. Never set dates, ranges or controls in the serif, never set the statement in the sans.

## Layout

A single centred column, max 480px wide, with 20px gutters and safe-area-aware top and bottom padding (bottom clears the fixed tab bar: 96px plus inset). Spacing runs on a 4px base: 4, 8, 12, 16, 24px; 24px separates the major bands (header, statement, chart, actions), 12px separates items inside a band. The ring scales to `min(288px, 76vw)` and sits centred with its legend as a figure caption. Actions stack full-width in a grid. Every interactive target is at least 44px; primary and secondary buttons and tabs are 52px.

## Elevation & Depth

Flat. No shadows, no gradients, no cards. Structure comes from hairline rules at two strengths and from a single raised-ground tone used only for hover. The one translucent surface is the fixed tab bar: ground at 92% with a 16px backdrop blur and a hairline top rule, so content scrolling beneath stays legible without a shadow.

### Named Rules
**The Hairline Rule.** Separate with a 1px rule, never with a box or a shadow. If a region needs to feel distinct, give it a rule or space, not a surface.

## Shapes

Gently softened controls (6px radius) on buttons, chips and the focus outline; nothing else is rounded because nothing else is a container. The chart's geometry is circles and short straight ticks: the orbit, cardinal crosshair ticks, week ticks, a dashed (2 4) range arc with ticked ends, and the reticle (circle plus four crosshair stubs). Line icons are drawn at 1.5px stroke with round caps and joins on a 24px grid.

## Components

### Buttons
Calm, framed, never a solid slab.
- **Shape:** gently softened (6px), 52px tall, 24px horizontal padding, 1px border.
- **Primary:** a Period Rose hairline frame with a 14% rose tint inside and ink text at 600. Hover and press deepen the tint to 24%.
- **Secondary:** transparent with a Rule Strong frame, ink text at 500; hover fills with raised ground.
- **Quiet:** borderless, muted ink, 44px tall, 12px padding.
- **States:** press scales to 0.98 over 160ms on the ease-out curve; disabled at 45% opacity. Focus is the global 2px ink outline, offset 3px.

### Chips
- **Style:** toggle buttons, 44px tall, 16px padding, Rule Strong frame, label size text, transparent at rest.
- **State:** selected (`aria-pressed`) fills with its tone at 16%, takes the tone as border, goes to 600 weight and reveals a check mark (width animates 0 to 12px). Tones: period, fertile, luteal, or ink.

### Navigation
- **Tab bar:** fixed to the bottom, four tabs up to 120px each, centred; translucent ground with blur and a top hairline; safe-area padded.
- **Tab:** 24px line icon over an 11px label in muted ink. Active (`aria-current="page"`) turns the label to ink at 600 and strokes the icon in Signal Amber.

### Cycle Ring (signature)
The star chart itself, a 300-unit SVG.
- **Orbit:** a Rule hairline circle with four cardinal crosshair ticks and Rule Strong week ticks just outside.
- **Points:** one per day. Fill colour by phase; follicular and unclassified days use Idle Point with no stroke.
- **Magnitude ramp:** radius encodes flow on a fixed ramp (spotting 3, light 4.5, medium 6, heavy 7.5); without flow, ovulation 5.5, peak 4.5, fertile 3.5, other 2.5.
- **Forecast:** days after today are hollow, filled with ground and stroked in their phase colour.
- **Range:** the next-period 80% range is a dashed Period Rose arc on an outer orbit, its ends ticked and labelled with the day of month.
- **Names:** each phase run of 3+ days gets its serif italic name in its phase ink, set inward from the orbit.
- **Today:** an amber reticle (circle plus crosshair stubs) around today's point. The cycle day numeral and a muted caption sit at the centre.
- **Motion:** on first render the points light up in day order (520ms fade, 18ms stagger), like stars appearing at dusk; disabled under reduced motion.

### Legend
A centred two-row key in caption size and muted ink: phase swatches on the first row; the hollow forecast swatch and the flow ramp ("schwach" to "stark") on the second. It is the ring's figure caption and ships wherever the ring does.

## Do's and Don'ts

### Do:
- **Do** separate regions with 1px Rule hairlines and space from the 4px scale.
- **Do** reserve Signal Amber for today and ovulation (and the active tab icon, which points at today's screen).
- **Do** pair every colour-coded meaning with a second channel: a written name, a legend entry, hollow versus filled, or a check mark.
- **Do** set names and states in the serif italic and all figures in the sans with tabular numerals.
- **Do** show forecasts as a range with hollow points, never as a single confident date.
- **Do** design both chart grounds; every new colour needs a day and a night value.
- **Do** keep every target at least 44px and turn off the light-up and other motion under reduced motion.

### Don't:
- **Don't** use cards, drop shadows or gradients; the build has none.
- **Don't** fill the primary button with solid rose; it is a hairline frame with a 14% tint.
- **Don't** load webfonts or any network asset; the serif and sans are system faces by brief.
- **Don't** use a phase colour for focus or caret; those are ink.
- **Don't** let colour alone carry a state.
