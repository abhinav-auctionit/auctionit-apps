import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { AppConfig } from '../../config/app-config.service';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { OtpSendMobileDto } from './dto/otp-send-mobile.dto';
import { OtpVerifyMobileDto } from './dto/otp-verify-mobile.dto';
import { OtpSendEmailDto } from './dto/otp-send-email.dto';
import { OtpVerifyEmailDto } from './dto/otp-verify-email.dto';
import { BidderRegisterDto } from './dto/bidder-register.dto';
import { SessionService, type SafeUser } from './session.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly otp: OtpService,
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
    // The legacy public register endpoint accepts a `role` field in the body.
    // Reject creating a user whose role doesn't match the calling app, so
    // someone can't POST {role:"admin"} from the bidder app.
    const appKey = this.appKeyOrThrow(req);
    if (appKey !== dto.role) {
      throw new ForbiddenException(
        `cannot register a "${dto.role}" account from the ${appKey} app`,
      );
    }
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
    this.assertOriginMatchesRole(req, user);
    await this.startSession(user.id, req, res);
    return user;
  }

  @Public()
  @Post('login/email-otp/send')
  @HttpCode(204)
  async loginEmailOtpSend(@Body() dto: OtpSendEmailDto): Promise<void> {
    await this.otp.send({ channel: 'email', target: dto.email, purpose: 'login' });
  }

  @Public()
  @Post('login/email-otp/verify')
  async loginEmailOtpVerify(
    @Body() dto: OtpVerifyEmailDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SafeUser> {
    const user = await this.auth.findUserByEmailForOtp(dto.email);
    if (!user) throw new UnauthorizedException('account not found');
    this.assertOriginMatchesRole(req, user);
    await this.otp.verify({
      channel: 'email',
      target: dto.email,
      purpose: 'login',
      code: dto.code,
    });
    await this.startSession(user.id, req, res);
    return user;
  }

  @Public()
  @Post('login/mobile-otp/send')
  @HttpCode(204)
  async loginMobileOtpSend(@Body() dto: OtpSendMobileDto): Promise<void> {
    await this.otp.send({
      channel: 'mobile',
      target: OtpService.mobileTarget(dto.mobileCountryCode, dto.mobileNumber),
      purpose: 'login',
    });
  }

  @Public()
  @Post('login/mobile-otp/verify')
  async loginMobileOtpVerify(
    @Body() dto: OtpVerifyMobileDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SafeUser> {
    const user = await this.auth.findUserByMobileForOtp(
      dto.mobileCountryCode,
      dto.mobileNumber,
    );
    if (!user) throw new UnauthorizedException('account not found');
    this.assertOriginMatchesRole(req, user);
    await this.otp.verify({
      channel: 'mobile',
      target: OtpService.mobileTarget(dto.mobileCountryCode, dto.mobileNumber),
      purpose: 'login',
      code: dto.code,
    });
    await this.startSession(user.id, req, res);
    return user;
  }

  @Public()
  @Post('bidder/otp/send')
  @HttpCode(204)
  async bidderOtpSend(@Body() dto: OtpSendMobileDto): Promise<void> {
    await this.otp.send({
      channel: 'mobile',
      target: OtpService.mobileTarget(dto.mobileCountryCode, dto.mobileNumber),
      purpose: 'bidder_register',
    });
  }

  @Public()
  @Post('bidder/otp/verify')
  async bidderOtpVerify(
    @Body() dto: OtpVerifyMobileDto,
  ): Promise<{ verificationToken: string }> {
    const challenge = await this.otp.verify({
      channel: 'mobile',
      target: OtpService.mobileTarget(dto.mobileCountryCode, dto.mobileNumber),
      purpose: 'bidder_register',
      code: dto.code,
    });
    return { verificationToken: challenge.id };
  }

  @Public()
  @Post('bidder/register')
  async bidderRegister(
    @Body() dto: BidderRegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SafeUser> {
    const appKey = this.appKeyOrThrow(req);
    if (appKey !== 'bidder') {
      throw new ForbiddenException(
        'bidder registration is only available on the bidder app',
      );
    }
    const user = await this.auth.registerBidder(dto);
    await this.startSession(user.id, req, res);
    return user;
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const cookieName = this.cookieNameForRequest(req);
    const sessionId = req.cookies?.[cookieName];
    if (sessionId) await this.sessions.revoke(sessionId);
    res.clearCookie(cookieName, this.cookieClearOptions());
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
    const cookieName = this.cookieNameForRequest(req);
    res.cookie(cookieName, session.id, this.cookieOptions(session.expiresAt));
  }

  private appKeyOrThrow(req: Request): 'admin' | 'bidder' | 'client' {
    const appKey = this.config.appKeyForOrigin(req.get('Origin'));
    if (!appKey) {
      throw new BadRequestException(
        'request Origin does not match any configured app — set APP_ADMIN_ORIGINS / APP_BIDDER_ORIGINS / APP_CLIENT_ORIGINS to include this origin',
      );
    }
    return appKey;
  }

  private cookieNameForRequest(req: Request): string {
    // appKeyOrThrow guarantees a non-null app key, so sessionCookieNameFor returns a string.
    return this.config.sessionCookieNameFor(this.appKeyOrThrow(req))!;
  }

  /**
   * Reject login attempts where the authenticated user's role doesn't match
   * the calling frontend. Stops e.g. an admin from logging in via the bidder
   * app, even before a session is created.
   */
  private assertOriginMatchesRole(req: Request, user: SafeUser): void {
    const appKey = this.appKeyOrThrow(req);
    if (appKey !== user.role) {
      throw new ForbiddenException(
        `accounts with role "${user.role}" cannot sign in here; please use the ${user.role} app`,
      );
    }
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
