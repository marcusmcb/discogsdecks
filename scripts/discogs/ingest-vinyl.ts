import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import zlib from "node:zlib";

import minimist from "minimist";
import sax from "sax";
import type { Tag } from "sax";
import { MongoClient } from "mongodb";

import {
  buildObjectKey,
  createS3Client,
  getObjectStoreConfigFromEnv,
  objectExists,
  putObject,
} from "./objectStore";

type Track = {
  position?: string;
  title?: string;
  duration?: string;
  artists?: string[];
};

type CatalogRelease = {
  discogsId: number;
  title?: string;
  artists: string[];
  year?: number;
  genres: string[];
  labels: Array<{ name: string; catno?: string }>;
  formats: Array<{ name: string; descriptions: string[] }>;
  tracklist: Track[];
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function isUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function toInt(value: string | undefined) {
  if (!value) return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function hasVinylFormat(formats: Array<{ name: string }>) {
  return formats.some((f) => f.name.toLowerCase() === "vinyl");
}

async function main() {
  const args = minimist(process.argv.slice(2), {
    string: ["source", "dumpKey", "mongoCollection", "mongoDb"],
    boolean: ["uploadRaw", "dryRun"],
    default: {
      uploadRaw: true,
      dryRun: false,
      mongoDb: process.env.MONGODB_DB || "discogsdecks",
      mongoCollection:
        process.env.MONGODB_CATALOG_COLLECTION || "discogs_catalog_vinyl",
    },
  });

  const source = args.source as string | undefined;
  if (!source) {
    throw new Error(
      "Usage: npm run discogs:ingest:vinyl -- --source <local_path_or_url_to_releases.xml.gz> [--uploadRaw=false] [--dryRun]",
    );
  }

  const objectStoreCfg = getObjectStoreConfigFromEnv();
  const shouldUploadRaw = Boolean(args.uploadRaw) && Boolean(objectStoreCfg);

  const { dumpFilePath, cleanup } = await materializeDumpToFile(source);

  if (shouldUploadRaw && objectStoreCfg) {
    const dumpKeyArg = args.dumpKey as string | undefined;
    const fallbackName = path.basename(dumpFilePath);

    const key = buildObjectKey(
      objectStoreCfg,
      dumpKeyArg || `raw/${new Date().toISOString().slice(0, 10)}/${fallbackName}`,
    );

    const s3 = createS3Client(objectStoreCfg);
    const exists = await objectExists(s3, objectStoreCfg.bucket, key);

    if (!exists) {
      await putObject(s3, {
        bucket: objectStoreCfg.bucket,
        key,
        body: fs.createReadStream(dumpFilePath),
        contentType: "application/gzip",
      });
      console.log(`[object-store] uploaded raw dump to s3://${objectStoreCfg.bucket}/${key}`);
    } else {
      console.log(`[object-store] raw dump already exists at s3://${objectStoreCfg.bucket}/${key}`);
    }
  }

  const mongoUri = requireEnv("MONGODB_URI");
  const mongoDbName = args.mongoDb as string;
  const mongoCollection = args.mongoCollection as string;

  const mongo = new MongoClient(mongoUri);
  await mongo.connect();

  const coll = mongo.db(mongoDbName).collection(mongoCollection);

  let processed = 0;
  let vinylUpsertsQueued = 0;

  const bulkOps: any[] = [];
  const BULK_SIZE = 1000;
  const MAX_PENDING_BATCHES = 6;
  let pendingBatches = 0;
  let writeChain: Promise<void> = Promise.resolve();
  let parseError: unknown = null;

  const parser = sax.parser(true, { lowercase: true, trim: true, normalize: true });

  let stack: string[] = [];
  let text = "";

  let current: CatalogRelease | null = null;
  let currentTrack: Track | null = null;
  let currentTrackArtists: string[] = [];

  let inReleaseArtists = false;
  let inTrackArtists = false;

  const pushGenre = (value: string) => {
    if (!current) return;
    const v = normalizeText(value);
    if (!v) return;
    current.genres.push(v);
  };

  const pushReleaseArtist = (value: string) => {
    if (!current) return;
    const v = normalizeText(value);
    if (!v) return;
    current.artists.push(v);
  };

  const pushTrackArtist = (value: string) => {
    const v = normalizeText(value);
    if (!v) return;
    currentTrackArtists.push(v);
  };

  parser.onopentag = (node: Tag) => {
    stack.push(node.name);
    text = "";

    if (node.name === "release") {
      const discogsId = toInt(node.attributes["id"] as string | undefined);
      if (!discogsId) {
        current = null;
        return;
      }
      current = {
        discogsId,
        title: undefined,
        artists: [],
        year: undefined,
        genres: [],
        labels: [],
        formats: [],
        tracklist: [],
      };
      return;
    }

    if (!current) return;

    if (node.name === "formats") {
      // nothing
    }

    if (node.name === "format") {
      const name = String((node.attributes["name"] as string | undefined) || "");
      if (name) {
        current.formats.push({ name, descriptions: [] });
      }
      return;
    }

    if (node.name === "labels") {
      // nothing
    }

    if (node.name === "label") {
      const name = String((node.attributes["name"] as string | undefined) || "");
      const catno = (node.attributes["catno"] as string | undefined) || undefined;
      if (name) current.labels.push({ name, catno });
      return;
    }

    if (node.name === "artists") {
      const parent = stack[stack.length - 2];
      if (parent === "release") inReleaseArtists = true;
      if (parent === "track") inTrackArtists = true;
      return;
    }

    if (node.name === "track") {
      currentTrack = {};
      currentTrackArtists = [];
      return;
    }
  };

  parser.ontext = (t: string) => {
    text += t;
  };

  const gunzip = zlib.createGunzip();
  const decoder = new TextDecoder("utf-8");

  const enqueueBulkWriteIfNeeded = () => {
    if (bulkOps.length < BULK_SIZE) return;
    enqueueBulkWrite();
  };

  const enqueueBulkWrite = () => {
    if (bulkOps.length === 0) return;
    const ops = bulkOps.splice(0, bulkOps.length);
    if (args.dryRun) return;

    pendingBatches++;
    if (pendingBatches > MAX_PENDING_BATCHES && !gunzip.isPaused()) {
      gunzip.pause();
    }

    writeChain = writeChain
      .then(async () => {
        await coll.bulkWrite(ops, { ordered: false });
      })
      .finally(() => {
        pendingBatches--;
        if (pendingBatches < Math.floor(MAX_PENDING_BATCHES / 2) && gunzip.isPaused()) {
          gunzip.resume();
        }
      });
  };

  parser.onclosetag = (name: string) => {
    const currentPath = stack.join("/");
    const value = normalizeText(text);

    if (current) {
      if (currentPath.endsWith("release/title")) {
        current.title = value || current.title;
      }

      if (currentPath.endsWith("release/year")) {
        const yr = toInt(value);
        if (yr) current.year = yr;
      }

      if (currentPath.endsWith("release/genres/genre")) {
        pushGenre(value);
      }

      if (currentPath.endsWith("release/formats/format/descriptions/description")) {
        const last = current.formats[current.formats.length - 1];
        if (last && value) last.descriptions.push(value);
      }

      // Release-level artists
      if (inReleaseArtists && currentPath.endsWith("release/artists/artist/name")) {
        pushReleaseArtist(value);
      }

      // Track parsing
      if (currentTrack) {
        if (currentPath.endsWith("release/tracklist/track/position")) {
          currentTrack.position = value;
        }
        if (currentPath.endsWith("release/tracklist/track/title")) {
          currentTrack.title = value;
        }
        if (currentPath.endsWith("release/tracklist/track/duration")) {
          currentTrack.duration = value;
        }

        if (inTrackArtists && currentPath.endsWith("release/tracklist/track/artists/artist/name")) {
          pushTrackArtist(value);
        }

        if (name === "artists") {
          inTrackArtists = false;
        }

        if (name === "track") {
          if (currentTrackArtists.length > 0) {
            currentTrack.artists = [...currentTrackArtists];
          }
          // Only store minimally valid tracks
          if (currentTrack.title) {
            current.tracklist.push(currentTrack);
          }
          currentTrack = null;
          currentTrackArtists = [];
        }
      }

      if (name === "artists" && inReleaseArtists) {
        inReleaseArtists = false;
      }

      if (name === "release") {
        processed++;

        // Only keep vinyl releases.
        const vinyl = hasVinylFormat(current.formats);
        if (vinyl) {
          vinylUpsertsQueued++;

          const doc = {
            _id: current.discogsId,
            discogsId: current.discogsId,
            title: current.title || "",
            artists: current.artists,
            year: current.year ?? null,
            genres: current.genres,
            labels: current.labels,
            formats: current.formats,
            tracklist: current.tracklist,
            updatedAt: new Date(),
          };

          bulkOps.push({
            updateOne: {
              filter: { _id: current.discogsId },
              update: { $set: doc },
              upsert: true,
            },
          });

          enqueueBulkWriteIfNeeded();
        }

        if (processed % 5000 === 0) {
          console.log(
            `[parse] processed=${processed.toLocaleString()} vinyl_upserts_queued=${vinylUpsertsQueued.toLocaleString()} pending_ops=${bulkOps.length} pending_batches=${pendingBatches}`,
          );
        }

        current = null;
      }
    }

    stack.pop();
    text = "";
  };

  parser.onerror = (err: Error) => {
    console.error("XML parse error:", err);
    parseError = err;
    gunzip.destroy(err);
  };

  // Stream parse: gz bytes -> gunzip -> sax
  gunzip.on("data", (chunk) => {
    const decoded = decoder.decode(chunk, { stream: true });
    if (decoded) parser.write(decoded);
  });
  gunzip.on("end", () => {
    const decoded = decoder.decode();
    if (decoded) parser.write(decoded);
    parser.close();
  });

  try {
    await pipeline(fs.createReadStream(dumpFilePath), gunzip);
  } finally {
    enqueueBulkWrite();
    await writeChain;
    await cleanup();
    await mongo.close();
  }

  if (parseError) throw parseError;

  console.log(
    `[done] processed=${processed.toLocaleString()} vinyl_upserts_queued=${vinylUpsertsQueued.toLocaleString()} dryRun=${Boolean(args.dryRun)}`,
  );
}

async function materializeDumpToFile(source: string): Promise<{
  dumpFilePath: string;
  cleanup: () => Promise<void>;
}> {
  if (!isUrl(source)) {
    await fs.promises.access(source, fs.constants.R_OK);
    return { dumpFilePath: source, cleanup: async () => {} };
  }

  const tmpDir = path.resolve(process.cwd(), ".tmp");
  await fs.promises.mkdir(tmpDir, { recursive: true });
  const url = new URL(source);
  const name = path.basename(url.pathname) || `discogs-releases-${Date.now()}.xml.gz`;
  const tmpFile = path.resolve(tmpDir, `${Date.now()}-${name}`);

  console.log(`[download] fetching ${source}`);
  const res = await fetch(source);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download: ${res.status} ${res.statusText}`);
  }

  const bodyStream = Readable.fromWeb(res.body as any);
  await pipeline(bodyStream, fs.createWriteStream(tmpFile));
  console.log(`[download] saved to ${tmpFile}`);

  return {
    dumpFilePath: tmpFile,
    cleanup: async () => {
      try {
        await fs.promises.unlink(tmpFile);
      } catch {
        // ignore
      }
    },
  };
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
