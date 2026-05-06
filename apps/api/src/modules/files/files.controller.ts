import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AppConfig } from '../../config/app-config.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { SafeUser } from '../auth/session.service';
import { FilesService } from './files.service';

interface UploadedMulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const toResponse = (file: {
  id: string;
  key: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string | null;
  createdAt: Date;
}) => ({
  id: file.id,
  key: file.key,
  originalName: file.originalName,
  mimeType: file.mimeType,
  sizeBytes: file.sizeBytes,
  uploadedById: file.uploadedById,
  createdAt: file.createdAt,
});

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly config: AppConfig,
  ) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: UploadedMulterFile | undefined,
    @CurrentUser() user: SafeUser,
  ) {
    if (!file) throw new BadRequestException('file field is required');
    const stored = await this.files.upload(
      {
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
      user,
    );
    return toResponse(stored);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return toResponse(await this.files.findOne(id));
  }

  @Get(':id/content')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SafeUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { file, stream } = await this.files.getContent(id, user);
    res.setHeader('Content-Type', file.mimeType);
    if (stream.contentLength != null) {
      res.setHeader('Content-Length', String(stream.contentLength));
    }
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.originalName)}"`,
    );
    return new StreamableFile(stream.body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SafeUser,
  ): Promise<void> {
    await this.files.delete(id, user);
  }
}
