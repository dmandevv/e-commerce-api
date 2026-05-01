import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateEnv } from './validateEnv.js';

describe('validateEnv', () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original, NODE_ENV: 'production' }; // ← force validation to run
  });

  afterEach(() => {
    process.env = original;
  });

  it('should not throw when all required vars are set', () => {
    process.env.MONGO_URI = 'mongodb://localhost:27017';
    process.env.REDIS_URL = 'redis://localhost:6379';

    expect(() => validateEnv(['MONGO_URI', 'REDIS_URL'])).not.toThrow();
  });

  it('should throw when a required var is missing', () => {
    delete process.env.MONGO_URI;

    expect(() => validateEnv(['MONGO_URI'])).toThrow(
      'Missing required environment variables: MONGO_URI'
    );
  });

  it('should throw when a required var is an empty string', () => {
    process.env.REDIS_URL = '';

    expect(() => validateEnv(['REDIS_URL'])).toThrow(
      'Missing required environment variables: REDIS_URL'
    );
  });

  it('should throw when a required var is whitespace only', () => {
    process.env.RABBITMQ_URL = '   ';

    expect(() => validateEnv(['RABBITMQ_URL'])).toThrow(
      'Missing required environment variables: RABBITMQ_URL'
    );
  });

  it('should list all missing vars in one error', () => {
    delete process.env.MONGO_URI;
    delete process.env.REDIS_URL;

    expect(() => validateEnv(['MONGO_URI', 'REDIS_URL'])).toThrow(
      'Missing required environment variables: MONGO_URI, REDIS_URL'
    );
  });

  it('should not throw for an empty required list', () => {
    expect(() => validateEnv([])).not.toThrow();
  });
});
