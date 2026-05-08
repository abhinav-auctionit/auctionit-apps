import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppConfig } from '../../../config/app-config.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SessionService } from '../session.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly config: AppConfig,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest<Request>();
    const appKey = this.config.appKeyForOrigin(req.get('Origin'));
    const cookieName = this.config.sessionCookieNameFor(appKey);
    const sessionId = req.cookies?.[cookieName];

    if (sessionId) {
      const session = await this.sessions.findActive(sessionId);
      if (session) {
        req.session = session;
        req.user = session.user;
        void this.sessions.touch(sessionId, session.lastSeenAt);
        return true;
      }
    }

    if (isPublic) return true;
    throw new UnauthorizedException('not authenticated');
  }
}
