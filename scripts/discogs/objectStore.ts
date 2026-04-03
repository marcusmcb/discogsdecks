import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";

export interface ObjectStoreConfig {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix?: string;
}

export function getObjectStoreConfigFromEnv(): ObjectStoreConfig | undefined {
  const bucket = process.env.OBJECT_STORE_BUCKET;
  const region = process.env.OBJECT_STORE_REGION || "auto";
  const endpoint = process.env.OBJECT_STORE_ENDPOINT;
  const accessKeyId = process.env.OBJECT_STORE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.OBJECT_STORE_SECRET_ACCESS_KEY;
  const prefix = process.env.OBJECT_STORE_PREFIX || "discogs";

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return undefined;
  }

  return {
    bucket,
    region,
    endpoint,
    accessKeyId,
    secretAccessKey,
    prefix,
  };
}

export function createS3Client(cfg: ObjectStoreConfig): S3Client {
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    forcePathStyle: false,
  });
}

export function buildObjectKey(cfg: ObjectStoreConfig, key: string) {
  const prefix = (cfg.prefix || "").replace(/^\/+|\/+$/g, "");
  const suffix = key.replace(/^\/+/, "");
  return prefix ? `${prefix}/${suffix}` : suffix;
}

export async function objectExists(client: S3Client, bucket: string, key: string) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function putObject(
  client: S3Client,
  params: {
    bucket: string;
    key: string;
    body: Uint8Array | Readable;
    contentType?: string;
  },
) {
  await client.send(
    new PutObjectCommand({
      Bucket: params.bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
}
