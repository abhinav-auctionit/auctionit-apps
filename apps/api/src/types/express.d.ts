import type { SessionWithUser, SafeUser } from '../modules/auth/session.service';

declare global {
  namespace Express {
    interface Request {
      session?: SessionWithUser;
      user?: SafeUser;
    }
  }
}

export {};
