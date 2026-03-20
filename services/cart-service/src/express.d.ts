import { JwtPayload } from '@ecommerce/shared/types';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      requestId?: string;
    }
  }
}
