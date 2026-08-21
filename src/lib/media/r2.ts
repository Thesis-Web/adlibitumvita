import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../env.js";
import type { MediaObjectStream, MediaStorage } from "./storage.js";

function requireR2Env() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error("R2 media driver selected but R2_* environment variables are incomplete.");
  }
  return { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET };
}

export class R2MediaStorage implements MediaStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const cfg = requireR2Env();
    this.bucket = cfg.R2_BUCKET;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${cfg.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.R2_ACCESS_KEY_ID,
        secretAccessKey: cfg.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getObjectStream(key: string): Promise<MediaObjectStream> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error(`R2 object not found: ${key}`);
    return {
      stream: result.Body as NodeJS.ReadableStream,
      mimeType: result.ContentType ?? "application/octet-stream",
      byteSize: result.ContentLength ?? 0,
    };
  }

  getPublicUrl(key: string): string | null {
    if (!env.R2_PUBLIC_BASE_URL) return null;
    return `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  }
}
