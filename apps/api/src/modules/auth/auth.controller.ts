import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { AppConfig } from '../../config/app-config.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { SessionService, type SafeUser } from './session.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SafeUser> {
    const user = await this.auth.register(dto);
    await this.startSession(user.id, req, res);
    return user;
  }

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SafeUser> {
    const user = await this.auth.login(dto);
    await this.startSession(user.id, req, res);
    return user;
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const sessionId = req.cookies?.[this.config.cookies.name];
    if (sessionId) await this.sessions.revoke(sessionId);
    res.clearCookie(this.config.cookies.name, this.cookieClearOptions());
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: SafeUser): SafeUser {
    return user;
  }

  @Roles('admin')
  @Post('users')
  async createUser(@Body() dto: CreateUserDto): Promise<SafeUser> {
    return this.auth.createUser(dto);
  }

  private async startSession(userId: string, req: Request, res: Response) {
    const session = await this.sessions.create(userId, {
      userAgent: req.get('user-agent') ?? undefined,
      ipAddress: req.ip,
    });
    res.cookie(this.config.cookies.name, session.id, this.cookieOptions(session.expiresAt));
  }

  private cookieOptions(expires: Date): CookieOptions {
    const { domain, secure } = this.config.cookies;
    return {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      ...(domain ? { domain } : {}),
      expires,
    };
  }

  private cookieClearOptions(): CookieOptions {
    const { domain, secure } = this.config.cookies;
    return {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      ...(domain ? { domain } : {}),
    };
  }
}
