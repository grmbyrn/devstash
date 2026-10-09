import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { fileExtension } from "@/lib/uploads";

/**
 * Cloudflare R2 object storage, over its S3-compatible API.
 *
 * The bucket is **private**. Nothing here ever returns a publicly fetchable
 * URL: `Item.fileUrl` holds the object *key*, and every read goes back through
 * `GET /api/files/[...key]`, which re-checks that the signed-in user owns the
 * item pointing at that key. A key that leaks therefore grants nothing on its
 * own, which is the whole reason for storing a key rather than a public URL.
 *
 * `R2_PUBLIC_URL` is consequently unused by this module, and left in the env
 * for the day a bucket is deliberately made public.
 */

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

// `undefined` = not yet resolved, `null` = resolved-but-unconfigured. Resolved
// lazily so importing this module never throws when the env is incomplete —
// callers get a clear error at call time instead of a crash at import.
let cachedConfig: R2Config | null | undefined;

function getConfig(): R2Config | null {
  if (cachedConfig !== undefined) return cachedConfig;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  cachedConfig =
    accountId && accessKeyId && secretAccessKey && bucket
      ? { accountId, accessKeyId, secretAccessKey, bucket }
      : null;

  return cachedConfig;
}

/** Whether R2 is configured. The upload route checks this before doing work. */
export function isStorageConfigured(): boolean {
  return getConfig() !== null;
}

let cachedClient: S3Client | undefined;

function getClient(): { client: S3Client; bucket: string } {
  const config = getConfig();
  if (!config) {
    throw new Error(
      "R2 is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME.",
    );
  }

  cachedClient ??= new S3Client({
    // R2 is single-region by design; "auto" is what Cloudflare documents.
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return { client: cachedClient, bucket: config.bucket };
}

/**
 * Build the object key for an upload.
 *
 * Shaped `{userId}/{uuid}{ext}`:
 *
 * - The **user prefix** makes ownership visible in the bucket and keeps one
 *   account's objects enumerable separately from another's.
 * - The **random name** means the original filename never reaches the key, so
 *   nothing has to be sanitised and two uploads of `screenshot.png` can't
 *   collide. The real name is kept in `Item.fileName` for display.
 * - Only the extension survives, lowercased, and only if the rules allowed it.
 */
export function buildObjectKey(userId: string, fileName: string): string {
  return `${userId}/${randomUUID()}${fileExtension(fileName)}`;
}

/**
 * The user id a key belongs to, or null if the key isn't shaped like one of
 * ours. A cheap pre-check for the proxy route — the authoritative ownership
 * test is still the database lookup, since a key is only trustworthy once an
 * item of that user's is found pointing at it.
 */
export function objectKeyOwner(key: string): string | null {
  const [userId, ...rest] = key.split("/");
  if (!userId || rest.length !== 1 || rest[0].length === 0) return null;
  return userId;
}

export interface PutObjectInput {
  key: string;
  body: Buffer;
  /** Stored as the object's Content-Type, for reference only. */
  contentType: string;
}

/** Upload one object. Overwrites, but keys are random so that never happens. */
export async function putObject({
  key,
  body,
  contentType,
}: PutObjectInput): Promise<void> {
  const { client, bucket } = getClient();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export interface StoredObject {
  body: Uint8Array;
  contentType: string | null;
  contentLength: number | null;
}

/** Fetch one object's bytes, or null if the key isn't in the bucket. */
export async function getObject(key: string): Promise<StoredObject | null> {
  const { client, bucket } = getClient();

  try {
    const result = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );

    if (!result.Body) return null;

    return {
      // Buffered rather than streamed: uploads are capped at 10 MB, and
      // buffering lets the route set a correct Content-Length and avoids
      // half-written responses on a mid-stream failure.
      body: await result.Body.transformToByteArray(),
      contentType: result.ContentType ?? null,
      contentLength: result.ContentLength ?? null,
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/**
 * Remove one object. Resolves `false` when the object was already gone, so
 * cleanup after a failed create — or a re-run of a delete — is harmless.
 */
export async function deleteObject(key: string): Promise<boolean> {
  const { client, bucket } = getClient();

  try {
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

/**
 * Delete an object without letting a storage failure propagate.
 *
 * Used where the object is already orphaned and the user's outcome shouldn't
 * depend on the cleanup: after an item row is deleted, and after a create that
 * failed behind a successful upload. Logged so the leak is at least visible.
 */
export async function deleteObjectQuietly(key: string): Promise<void> {
  try {
    await deleteObject(key);
  } catch (error) {
    console.error(`R2 cleanup failed for key ${key}:`, error);
  }
}

/** True for the SDK's various "no such key" shapes. */
function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const name = (error as { name?: unknown }).name;
  const status = (error as { $metadata?: { httpStatusCode?: number } })
    .$metadata?.httpStatusCode;
  return name === "NoSuchKey" || name === "NotFound" || status === 404;
}
