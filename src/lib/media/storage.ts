export interface MediaObjectStream {
  stream: NodeJS.ReadableStream;
  mimeType: string;
  byteSize: number;
}

/**
 * Provider-neutral media storage seam. `local` (filesystem under
 * MEDIA_LOCAL_PATH) is the working default; `r2` is Cloudflare R2 via the
 * S3-compatible API, enabled by setting MEDIA_DRIVER=r2 plus credentials.
 * Callers persist provider + key, never a signed/expiring URL.
 */
export interface MediaStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** Streams the object; used for both public and member-gated delivery via the app's own auth-checked route. */
  getObjectStream(key: string): Promise<MediaObjectStream>;
  /** A direct public URL when the provider can serve it without proxying (e.g. R2 custom domain). Null forces app-proxied delivery. */
  getPublicUrl(key: string): string | null;
}
