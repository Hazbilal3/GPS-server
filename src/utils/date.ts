/**
 * Parse a YYYY-MM-DD date string as noon EST (UTC-5).
 * Storing at noon avoids the UTC-midnight → previous-day bug for US clients.
 * America/New_York observes EST (UTC-5) in winter and EDT (UTC-4) in summer;
 * noon EST is always the correct calendar day for any US timezone.
 */
export function parseEstDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00-05:00`);
}
