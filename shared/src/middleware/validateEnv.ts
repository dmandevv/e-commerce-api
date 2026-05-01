export function validateEnv(required: string[]): void {
  if (process.env.NODE_ENV === 'test') return;

  const missing = required.filter(
    (key) => !process.env[key] || process.env[key]!.trim() === ''
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Check your .env file or deployment configuration.`
    );
  }
}
