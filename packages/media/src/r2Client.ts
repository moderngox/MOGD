import { AwsV4Signer } from "aws4fetch";

/**
 * Low-level, provider-neutral R2 (S3-compatible) client. Adapted from a
 * generic helper reviewed in SPIDRA (see docs/SPIDRA_MIGRATION.md) — signing
 * approach and documented workarounds are reused, all domain-specific
 * naming (videos/exercises) has been stripped so this operates on plain
 * bucket/key pairs.
 */
export interface R2Credentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function objectUrl(creds: R2Credentials, bucket: string, key: string): string {
  return `https://${creds.accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
}

/**
 * Signs a request with AwsV4Signer directly and issues it via the global
 * `fetch(url, init)` form ourselves — deliberately NOT `AwsClient.fetch()`,
 * which rebuilds the signed request as `new Request(...)` before calling
 * `fetch(request)`. That Request-rebuilding path makes Node's fetch (undici)
 * stream a Blob/Uint8Array body via chunked transfer-encoding with no
 * Content-Length, which R2's S3-compatible API rejects (411
 * MissingContentLength). Passing the body straight into a plain
 * `fetch(url, init)` call lets undici compute Content-Length itself.
 */
async function signedFetch(
  creds: R2Credentials,
  method: string,
  url: string,
  init: { headers?: Record<string, string>; body?: Blob } = {},
): Promise<Response> {
  const signer = new AwsV4Signer({
    url,
    method,
    headers: init.headers,
    body: init.body,
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const signed = await signer.sign();
  return fetch(signed.url.toString(), {
    method: signed.method,
    headers: signed.headers,
    body: init.body,
  });
}

export async function putR2Object(
  creds: R2Credentials,
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
  cacheControl = "no-cache",
): Promise<void> {
  const res = await signedFetch(creds, "PUT", objectUrl(creds, bucket, key), {
    body: new Blob([new Uint8Array(body)], { type: contentType }),
    // "no-cache" (not "no-store") still lets clients cache the response but
    // forces conditional revalidation against R2's auto-computed ETag before
    // reuse — needed for the exercise-asset replace flow, where the same key
    // legitimately gets new bytes and a stale cached copy must not linger.
    headers: { "Content-Type": contentType, "Cache-Control": cacheControl },
  });
  if (!res.ok) {
    throw new Error(`R2 PUT failed for "${key}" (${res.status}): ${await res.text()}`);
  }
}

/** Best-effort delete. Callers must treat a thrown error here as non-fatal
 * when used for cleanup — a failed cleanup must never block the response to
 * whoever is waiting on the actual upload/replace result. */
export async function deleteR2Object(
  creds: R2Credentials,
  bucket: string,
  key: string,
): Promise<void> {
  const res = await signedFetch(creds, "DELETE", objectUrl(creds, bucket, key));
  if (!res.ok) {
    throw new Error(`R2 DELETE failed for "${key}" (${res.status}): ${await res.text()}`);
  }
}

/**
 * Query-string-signed (not header-signed) PUT URL a client can use to
 * upload directly to R2, bypassing our own server for large files.
 * `X-Amz-Expires` is set explicitly rather than left to aws4fetch's
 * `signQuery` default (24h) — an hour is plenty for a slow upload, no
 * reason to leave a live signed URL around longer than that.
 */
export async function getPresignedUploadUrl(
  creds: R2Credentials,
  bucket: string,
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const url = new URL(objectUrl(creds, bucket, key));
  url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
  const signer = new AwsV4Signer({
    url: url.toString(),
    method: "PUT",
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    service: "s3",
    region: "auto",
    signQuery: true,
  });
  const signed = await signer.sign();
  return signed.url.toString();
}

/**
 * Query-string-signed GET URL for private, authorization-gated reads (e.g.
 * a user's own assessment/progress photo). This is the only way private
 * bucket objects should ever be served — never construct or expose an
 * unrestricted public URL for them.
 */
export async function getPresignedGetUrl(
  creds: R2Credentials,
  bucket: string,
  key: string,
  expiresInSeconds = 300,
): Promise<string> {
  const url = new URL(objectUrl(creds, bucket, key));
  url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
  const signer = new AwsV4Signer({
    url: url.toString(),
    method: "GET",
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    service: "s3",
    region: "auto",
    signQuery: true,
  });
  const signed = await signer.sign();
  return signed.url.toString();
}
