import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storage: Storage;
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    const projectId = this.configService.get<string>('GCS_PROJECT_ID');
    const keyFilename = this.configService.get<string>('GCS_KEY_FILE');
    this.bucketName = this.configService.get<string>('GCS_BUCKET_NAME') || 'scram-evidence';
    this.publicUrl = this.configService.get<string>('GCS_PUBLIC_URL') || '';

    // Initialize Google Cloud Storage
    const storageConfig: any = {};

    if (projectId) {
      storageConfig.projectId = projectId;
    }

    if (keyFilename) {
      storageConfig.keyFilename = keyFilename;
    }

    this.storage = new Storage(storageConfig);

    this.logger.log(`StorageService initialized with GCS bucket: ${this.bucketName}`);
  }

  /**
   * Save a base64 encoded file to Google Cloud Storage
   * @param base64Data Base64 encoded file data (with or without data URI prefix)
   * @param type Type of evidence (PHOTO or SIGNATURE)
   * @param orderId Order ID for organizing files
   * @returns Public URL of the uploaded file
   */
  async saveBase64File(base64Data: string, type: string, orderId: string): Promise<string> {
    // Remove data URI prefix if present
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');

    // Determine content type and extension based on data URI
    let contentType = 'image/png';
    let ext = 'png';
    if (base64Data.includes('data:image/jpeg')) {
      contentType = 'image/jpeg';
      ext = 'jpg';
    } else if (base64Data.includes('data:image/png')) {
      contentType = 'image/png';
      ext = 'png';
    } else if (base64Data.includes('data:image/webp')) {
      contentType = 'image/webp';
      ext = 'webp';
    }

    // Create filename with timestamp
    const timestamp = Date.now();
    const filename = `${type.toLowerCase()}_${timestamp}.${ext}`;
    const filePath = `evidence/${orderId}/${filename}`;

    // Decode base64 to buffer
    const buffer = Buffer.from(base64Clean, 'base64');

    // Get bucket and file reference
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(filePath);

    // Upload to GCS
    // Note: Don't use public:true when bucket has uniform bucket-level access enabled
    // Instead, rely on bucket-level IAM policy (allUsers:objectViewer)
    await file.save(buffer, {
      metadata: {
        contentType: contentType,
        cacheControl: 'public, max-age=31536000', // Cache for 1 year
      },
    });

    // Return the public URL
    const publicUrl = this.publicUrl
      ? `${this.publicUrl}/${filePath}`
      : `https://storage.googleapis.com/${this.bucketName}/${filePath}`;

    this.logger.log(`Saved ${type} for order ${orderId}: ${publicUrl}`);
    return publicUrl;
  }

  /**
   * Get file from GCS as buffer (for internal use)
   */
  async getFile(filePath: string): Promise<Buffer> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filePath);

      const [exists] = await file.exists();
      if (!exists) {
        throw new NotFoundException(`File not found: ${filePath}`);
      }

      const [buffer] = await file.download();
      return buffer;
    } catch (error) {
      this.logger.error(`Error getting file ${filePath}: ${error.message}`);
      throw new NotFoundException(`File not found: ${filePath}`);
    }
  }

  /**
   * Delete a file from GCS
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filePath);

      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
        this.logger.log(`Deleted file: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Error deleting file ${filePath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Extract file path from public URL
   */
  extractPathFromUrl(url: string): string | null {
    if (!url) return null;

    // Handle GCS URL formats
    const patterns = [
      /storage\.googleapis\.com\/[^/]+\/(.+)$/, // https://storage.googleapis.com/bucket/path
      /evidence\/[^/]+\/[^/]+$/, // evidence/orderId/filename
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return null;
  }
}
