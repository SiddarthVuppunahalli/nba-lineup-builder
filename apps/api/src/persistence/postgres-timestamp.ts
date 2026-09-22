/** PostgreSQL returns timestamptz values as space-separated strings, but API dates are ISO 8601. */
export function toIsoTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid database timestamp: ${value}`);
  }
  return parsed.toISOString();
}
