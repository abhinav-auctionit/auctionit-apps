import { Global, Module, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';
import { FILE_STORAGE, type FileStorage } from './file-storage';
import { LocalDiskStorage } from './local-disk.storage';
import { R2Storage } from './r2.storage';

const buildStorage = (config: AppConfig): FileStorage => {
  const logger = new Logger('StorageModule');
  const { driver } = config.storage;

  if (driver === 'r2') {
    const { accountId, accessKeyId, secretAccessKey, bucket } = config.storage.r2;
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error(
        'STORAGE_DRIVER=r2 requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET',
      );
    }
    logger.log(`using R2 storage (bucket=${bucket})`);
    return new R2Storage({ accountId, accessKeyId, secretAccessKey, bucket });
  }

  logger.log(`using local-disk storage (dir=${config.storage.localDir})`);
  return new LocalDiskStorage(config.storage.localDir);
};

@Global()
@Module({
  providers: [
    {
      provide: FILE_STORAGE,
      inject: [AppConfig],
      useFactory: buildStorage,
    },
  ],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
