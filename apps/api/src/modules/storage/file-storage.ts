import type { Readable } from 'node:stream';

export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface PutInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface GetResult {
  body: Readable;
  contentType: string;
  contentLength?: number;
}

export interface FileStorage {
  put(input: PutInput): Promise<void>;
  get(key: string): Promise<GetResult>;
  delete(key: string): Promise<void>;
}
