/**
 * Validates that a secret (JWT signing key, etc.) is strong enough to use.
 *
 * Called at service startup. Throws fatally if the secret fails checks.
 * The app should exit rather than boot with a weak secret.
 *
 * Checks in order (fail fast):
 *   1. Not empty/undefined
 *   2. Length >= 32 chars (256 bits if hex)
 *   3. Not in the known-weak-defaults list
 *   4. Minimum unique characters (catches "aaaaa..." or "abc123abc123...")
 */

export class WeakSecretError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WeakSecretError';
    }
}

const KNOWN_WEAK_SECRETS = new Set([
    'dev_secret_change_in_production',
    'ci_test_secret',
    'secret',
    'secretkey',
    'your-secret-key',
    'your-256-bit-secret',
    'changeme',
    'password',
    'test',
    'jwt',
    'jwtsecret',
]);
const MIN_LENGTH = 32;
const MIN_UNIQUE_CHARS = 10;

export function validateJwtSecret(
    secret: string | undefined,
    envVarName = 'JWT_SECRET'
) : void {
    if (!secret) {
        throw new WeakSecretError(`${envVarName} is not set. Generate a strong one: openssl rand -hex 32`);
    }

    if (KNOWN_WEAK_SECRETS.has(secret.toLowerCase())) {
        throw new WeakSecretError(
            `${envVarName} is a commonly used default value. ` +
            `Generate one: openssl rand -hex 32`
        );
    }

    if (secret.length < MIN_LENGTH) {
        throw new WeakSecretError(
            `${envVarName} length must be at least ${MIN_LENGTH} chars (got ${secret.length}). ` +
            `Generate one: openssl rand -hex 32`
        );
    }

    const numUniqueChars = new Set(secret).size
    if (numUniqueChars < MIN_UNIQUE_CHARS) {
        throw new WeakSecretError(
            `${envVarName} contains only ${numUniqueChars} unique chars (should have minimum ${MIN_UNIQUE_CHARS}). ` +
            `Generate one: openssl rand -hex 32`
        );
    }
}
