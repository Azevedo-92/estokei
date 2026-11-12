/**
 * Strip a leading BOM (U+FEFF) and surrounding whitespace from an env var.
 *
 * WHY: env values written from Windows tooling can carry a leading BOM or
 * trailing whitespace, and both are non-ISO-8859-1 characters that break the
 * fetch API when the value is used as an HTTP header (e.g. Supabase's apikey).
 *
 * The value must be passed in via a literal `process.env.X` expression at the
 * call site so Next.js can inline it into the client bundle at build time.
 */
export function sanitizeEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value.replace(/^﻿/, '').trim()
}
