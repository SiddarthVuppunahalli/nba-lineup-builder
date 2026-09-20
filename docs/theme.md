# Theme guide

Lineup Engine now uses a dark, arena-inspired visual direction derived from the landing image. This
design supersedes the cream, coral, and sage palette introduced in Phase 3.5. The semantic roles and
accessibility requirements from that phase remain; only their visual expression has changed. Shared
theme variables live in `apps/web/src/styles.css`.

| Role            | Variable                | Color                        |
| --------------- | ----------------------- | ---------------------------- |
| Page            | `--color-page`          | Near-black `#060A0F`         |
| Panels          | `--color-surface`       | Deep blue-black `#0D141D`    |
| Subtle surfaces | `--color-surface-tint`  | Slate blue-black `#121C27`   |
| Main text       | `--color-text`          | Arena off-white `#F3F0E9`    |
| Secondary text  | `--color-muted`         | Silver gray `#9BA6B2`        |
| Borders         | `--color-border`        | Steel `#263240`              |
| Strong borders  | `--color-border-strong` | Silver slate `#536170`       |
| Primary accent  | `--color-coral-ink`     | Basketball orange `#F29A52`  |
| Accent surface  | `--color-coral-soft`    | Burnt-orange black `#2B1A10` |
| Success         | `--color-success`       | Court green `#6BD596`        |
| Warning         | `--color-warning`       | Warm amber `#F5B84B`         |
| Error           | `--color-error`         | Signal red `#FF756F`         |

The legacy `coral` and `sage` variable names remain temporarily because current workflow components
already consume them as semantic accent and positive roles. New work should prefer role-based names
when a dedicated token exists. Orange is reserved for primary emphasis, selections, and basketball
identity; it is not the error color. Green, amber, and red communicate success, warning, and error,
with written labels or icons providing the same meaning without color.

Use near-black surfaces as the dominant field, silver borders for structure, and off-white text for
readability. Panels should feel layered rather than glossy. The landing image may carry the strongest
contrast and atmosphere; workflow interiors should remain quieter so controls and evidence stay
legible.

Keep DM Sans for body copy and Manrope for headings, with system fallbacks. Maintain visible keyboard
focus, 16px-or-larger body text, reduced-motion behavior, mobile-safe viewport units, and one-column
layouts on narrow screens. Motion must remain restrained and must never intercept scrolling.

## Workflow layout and interaction

Build, Repair, and Compare use the same content width, panel radius, border weight, heading rhythm,
button hierarchy, loading treatment, empty-state voice, error treatment, and focus ring. Player-pool
selection stays above the workflow so a user can change context without learning a second control.

Repair and Compare are vertical decision flows rather than split-screen dashboards:

1. establish the source lineup or version history;
2. describe intent or select the two versions;
3. run the deterministic operation;
4. reveal the result directly below the controls.

Numbered step labels use orange for orientation, not status. Selected comparison versions use an
orange border and surface plus explicit “Starting version” and “Compared version” labels, so the
relationship does not depend on color or arrow direction.

Successful results receive programmatic heading focus and a short vertical reveal. Back controls
return focus and scroll position to the relevant editor. Under `prefers-reduced-motion: reduce`, all
scrolling becomes immediate and transitions/animations collapse to effectively zero duration.
Technical detail stays available in native `details` disclosures: data provenance and solver scope,
advanced intent controls, metric evidence, and comparison requirements.

At narrow widths, workflow grids collapse to one column, paired comparison cards stack, action
groups become full-width, and wide requirement tables remain horizontally scrollable within their
own region. Long player and version names wrap rather than forcing page-level overflow.
