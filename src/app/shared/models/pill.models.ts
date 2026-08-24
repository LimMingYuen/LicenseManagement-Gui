/**
 * Semantic tone for the shared `.pill` chip primitive (see :root and the
 * STATUS PILL block in src/styles.scss).
 *
 * Every value here has a matching `.pill--<tone>` class. Keeping the union
 * narrow is the point: a template writes `'pill--' + someTone()`, so the
 * compiler is what stops a typo'd tone from silently rendering an unstyled
 * chip. Add a tone here and in styles.scss together, never in one alone.
 *
 * Tones name meaning, not colour — `danger`, not `red`.
 */
export type PillTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
