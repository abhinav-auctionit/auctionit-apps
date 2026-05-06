import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { StoredFile } from '@prisma/client';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { SafeUser } from '../auth/session.service';
import { FILE_STORAGE, type FileStorage, type GetResult } from '../storage/file-storage';

export interface UploadInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async upload(input: UploadInput, uploader: SafeUser): Promise<StoredFile> {
    if (!input.buffer || input.size === 0) {
      throw new BadRequestException('empty file');
    }
    const { maxUploadBytes, allowedMime } = this.config.storage;
    if (input.size > maxUploadBytes) {
      throw new PayloadTooLargeException(
        `file exceeds ${maxUploadBytes} bytes`,
      );
    }
    const mime = (input.mimeType || '').toLowerCase();
    if (allowedMime.length > 0 && !allowedMime.includes(mime)) {
      throw new UnsupportedMediaTypeException(`mime ${mime} is not allowed`);
    }

    const key = this.buildKey(input.originalName);
    await this.storage.put({ key, body: input.buffer, contentType: mime });

    return this.prisma.storedFile.create({
      data: {
        key,
        originalName: input.originalName.slice(0, 512),
        mimeType: mime,
        sizeBytes: input.size,
        uploadedById: uploader.id,
      },
    });
  }

  async findOne(id: string): Promise<StoredFile> {
    const row = await this.prisma.storedFile.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('file not found');
    return row;
  }

  async getContent(
    id: string,
    actor: SafeUser,
  ): Promise<{ file: StoredFile; stream: GetResult }> {
    const file = await this.findOne(id);
    this.assertCanAccess(file, actor);
    const stream = await this.storage.get(file.key);
    return { file, stream };
  }

  async delete(id: string, actor: SafeUser): Promise<void> {
    const file = await this.findOne(id);
    this.assertCanAccess(file, actor);
    await this.storage.delete(file.key);
    await this.prisma.storedFile.delete({ where: { id: file.id } });
  }

  private assertCanAccess(file: StoredFile, actor: SafeUser): void {
    if (actor.role === 'admin') return;
    if (file.uploadedById && file.uploadedById === actor.id) return;
    throw new ForbiddenException('not allowed');
  }

  private buildKey(originalName: string): string {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const ext = extname(originalName).toLowerCase().slice(0, 16);
    return `uploads/${yyyy}/${mm}/${randomUUID()}${ext}`;
  }
}
