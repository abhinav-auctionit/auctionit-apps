import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { users } from '../../database/schema';
import { hashPassword, verifyPassword } from './password';
import type { SafeUser } from './session.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async register(dto: RegisterDto): Promise<SafeUser> {
    return this.createUser(dto);
  }

  async createUser(dto: CreateUserDto | RegisterDto): Promise<SafeUser> {
    const existing = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email),
    });
    if (existing) throw new ConflictException('email already registered');

    const passwordHash = await hashPassword(dto.password);
    const [row] = await this.db
      .insert(users)
      .values({
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: dto.role,
      })
      .returning();
    if (!row) throw new Error('failed to create user');

    const { passwordHash: _ignored, ...user } = row;
    return user;
  }

  async login(dto: LoginDto): Promise<SafeUser> {
    const row = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email),
    });
    if (!row) throw new UnauthorizedException('invalid credentials');

    const ok = await verifyPassword(row.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('invalid credentials');

    const { passwordHash: _ignored, ...user } = row;
    return user;
  }
}
