import { createAuthenticate, authorize } from '@ecommerce/shared/middleware';
import { config } from '../config/index.js';
import { blacklist } from '../lib/blacklist.js';

export const authenticate = createAuthenticate({
  jwtSecret: config.jwtSecret,
  blacklist,
});

export { authorize };
