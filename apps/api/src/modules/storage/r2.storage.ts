import { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { NotFoundException } from '@nestjs/common';
import type { FileStorage, GetResult, PutInput } from './file-storage';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export class R2Storage implements FileStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(cfg: R2Config) {
    this.bucket = cfg.bucket;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }

  async put({ key, body, contentType }: PutInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.byteLength,
      }),
    );
  }

  async get(key: string): Promise<GetResult> {
    try {
      const out = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const body = out.Body;
      if (!body) throw new NotFoundException('file not found');
      return {
        body: body as Readable,
        contentType: out.ContentType ?? 'application/octet-stream',
        contentLength: out.ContentLength,
      };
    } catch (err) {
      if (err instanceof S3ServiceException && err.name === 'NoSuchKey') {
        throw new NotFoundException('file not found');
      }
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
