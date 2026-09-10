# Theme guide

Lineup Engine uses a warm, light visual direction. The shared theme variables live in `apps/web/src/styles.css`.

| Role                         | Variable               | Color                 |
| ---------------------------- | ---------------------- | --------------------- |
| Page                         | `--color-page`         | Cream `#F7F3EB`       |
| Panels                       | `--color-surface`      | Ivory `#FFFCF7`       |
| Subtle surfaces              | `--color-surface-tint` | Beige `#F1ECE2`       |
| Main text                    | `--color-text`         | Charcoal `#30362F`    |
| Secondary text               | `--color-muted`        | Olive gray `#65665B`  |
| Coral accents                | `--color-coral`        | Muted coral `#C66B53` |
| Coral text and solid actions | `--color-coral-ink`    | Deep coral `#994730`  |
| Selected surfaces            | `--color-coral-soft`   | Pale coral `#F6E6DC`  |
| Sage accents                 | `--color-sage`         | Muted sage `#7E947A`  |
| Sage text and focus          | `--color-sage-ink`     | Deep sage `#4E674B`   |
| Positive surfaces            | `--color-sage-soft`    | Pale sage `#EAF0E5`   |

Use muted coral for selection accents and deep coral for solid primary buttons with ivory text. Use sage for strengths and positive indicators. Muted accent colors are not body text colors; darker ink variants keep small text readable. Warnings include written descriptions and icons rather than relying on color alone.

Keep cream and ivory dominant, with subtle borders and shadows. Use DM Sans for body copy and Manrope for headings, with local system fallbacks. Maintain clear keyboard focus on player rows, buttons, links, selectors, and expandable metrics. Preserve reduced-motion support and one-column layouts on narrow screens.

Upcoming generation, comparison, and saved-scenario screens should reuse these roles and the panel/control radius variables rather than introduce an independent palette.
