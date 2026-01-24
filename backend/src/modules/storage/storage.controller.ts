import { Controller, Get, Param, Res, NotFoundException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  private readonly logger = new Logger(StorageController.name);
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('GCS_BUCKET_NAME') || 'scram-evidence';
    this.publicUrl = this.configService.get<string>('GCS_PUBLIC_URL') || '';
  }

  /**
   * Redirect to GCS public URL for file access
   * This endpoint handles legacy paths that aren't full URLs
   */
  @Get('*')
  @ApiOperation({ summary: 'Redirect to file in Google Cloud Storage' })
  async serveFile(@Param() params: any, @Res() res: Response) {
    const storageKey = params[0];

    if (!storageKey) {
      throw new NotFoundException('File path required');
    }

    this.logger.debug(`Redirecting to GCS: ${storageKey}`);

    // Build the redirect URL
    const redirectUrl = this.publicUrl
      ? `${this.publicUrl}/${storageKey}`
      : `https://storage.googleapis.com/${this.bucketName}/${storageKey}`;

    return res.redirect(302, redirectUrl);
  }
}
