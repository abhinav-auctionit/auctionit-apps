import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { Logger, NotFoundException } from '@nestjs/common';
import type { FileStorage, GetResult, PutInput } from './file-storage';

export class LocalDiskStorage implements FileStorage {
  private readonly logger = new Logger(LocalDiskStorage.name);
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = isAbsolute(rootDir) ? rootDir : resolve(process.cwd(), rootDir);
  }

  async put({ key, body }: PutInput): Promise<void> {
    const target = this.resolveKey(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async get(key: string): Promise<GetResult> {
    const target = this.resolveKey(key);
    let info;
    try {
      info = await stat(target);
    } catch {
      throw new NotFoundException('file not found');
    }
    return {
      body: createReadStream(target),
      contentType: 'application/octet-stream',
      contentLength: info.size,
    };
  }

  async delete(key: string): Promise<void> {
    const target = this.resolveKey(key);
    try {
      await unlink(target);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw err;
      this.logger.debug(`delete: ${key} already gone`);
    }
  }

  private resolveKey(key: string): string {
    const target = resolve(this.root, key);
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      throw new Error('invalid storage key');
    }
    return join(target);
  }
}
