/** Minimal className joiner — filters falsy values, no extra dependency for the handful of conditional classes the design system components need. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
