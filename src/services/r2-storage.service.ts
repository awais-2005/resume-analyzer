import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import path from 'path';
import { ApiError } from '../utils/ApiError';
import { HttpStatus } from '../utils/HttpStatus';
import { HTTPRequest } from 'puppeteer';

type ResumePdfVariant = 'unfixed' | 'fixed';

export class R2StorageService {
  private static instance: R2StorageService;
  private client?: S3Client;

  public static getInstance(): R2StorageService {
    if (!R2StorageService.instance) {
      R2StorageService.instance = new R2StorageService();
    }
    return R2StorageService.instance;
  }

  public buildResumePdfKey(
    userId: string,
    historyId: string,
    variant: ResumePdfVariant,
    originalName = 'resume.pdf'
  ): string {
    const baseName = this.slugify(path.parse(originalName).name || 'resume');
    return [
      'resumes',
      this.slugify(userId),
      this.slugify(historyId),
      `${variant}-${Date.now()}-${randomUUID()}-${baseName}.pdf`,
    ].join('/');
  }

  public async uploadPdf(buffer: Buffer, key: string): Promise<string> {
    try {
      await this.getClient().send(
        new PutObjectCommand({
          Bucket: this.getBucketName(),
          Key: key,
          Body: buffer,
          ContentType: 'application/pdf',
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, `Failed to upload PDF to R2: ${message}`);
    }

    return this.getPublicObjectUrl(key);
  }

  private getClient(): S3Client {
    if (!this.client) {
      const endpoint = this.getEndpoint();
      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

      if (!endpoint || !accessKeyId || !secretAccessKey) {
        throw new ApiError(
          HttpStatus.INTERNAL_SERVER_ERROR,
          'R2 storage is not configured'
        );
      }

      this.client = new S3Client({
        region: process.env.R2_REGION || 'auto',
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    }

    return this.client;
  }

  private getBucketName(): string {
    const bucketName = process.env.R2_BUCKET;
    if (!bucketName) {
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'R2 bucket name is not configured'
      );
    }
    return bucketName;
  }

  private getEndpoint(): string | undefined {
    const r2_endpoint = process.env.R2_ENDPOINT;
    if (!r2_endpoint) {
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'R2 endpoint is not configured'
      );
    }
    return r2_endpoint;
  }

  private getPublicObjectUrl(key: string): string {
    const publicBaseUrl = this.getPublicBaseUrl();
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');

    return `${publicBaseUrl}/${encodedKey}`;
  }

  private getPublicBaseUrl(): string {
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (publicUrl) {
      return publicUrl;
    }

    const endpoint = this.getEndpoint();
    return `${endpoint}/${this.getBucketName()}`;
  }

  private slugify(value: string): string {
    return (
      value
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || 'resume'
    );
  }
}
