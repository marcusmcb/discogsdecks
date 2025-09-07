import { users, releases, tracks, crates, crateTracks, type User, type InsertUser, type Release, type InsertRelease, type Track, type InsertTrack, type Crate, type InsertCrate, type CrateTrack, type InsertCrateTrack } from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, or, desc, asc, sql, count, isNotNull } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserTokens(userId: string, token: string, secret: string, username: string): Promise<void>;
  
  getUserReleases(userId: string): Promise<Release[]>;
  createRelease(release: InsertRelease): Promise<Release>;
  getReleaseByDiscogsId(discogsId: number): Promise<Release | undefined>;
  
  getUserTracks(userId: string, filters?: {
    search?: string;
    yearFrom?: number;
    yearTo?: number;
    genre?: string;
    format?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<{ tracks: Track[]; total: number }>;
  createTrack(track: InsertTrack): Promise<Track>;
  updateTrack(id: string, updates: Partial<Omit<Track, 'id' | 'userId' | 'releaseId' | 'createdAt'>>): Promise<Track>;
  updateRelease(id: string, updates: Partial<Omit<Release, 'id' | 'userId' | 'discogsId' | 'createdAt'>>): Promise<Release>;
  getTracksByReleaseId(releaseId: string): Promise<Track[]>;
  deleteUserTracks(userId: string): Promise<void>;
  deleteUserReleases(userId: string): Promise<void>;
  
  // Genre management
  getUserGenres(userId: string): Promise<string[]>;
  
  // Crate management
  getUserCrates(userId: string): Promise<Crate[]>;
  createCrate(crate: InsertCrate): Promise<Crate>;
  updateCrate(id: string, updates: Partial<Omit<Crate, 'id' | 'userId' | 'createdAt'>>): Promise<Crate>;
  deleteCrate(id: string): Promise<void>;
  addTrackToCrate(crateId: string, trackId: string): Promise<CrateTrack>;
  removeTrackFromCrate(crateId: string, trackId: string): Promise<void>;
  getCrateTracks(crateId: string): Promise<Track[]>;
  isTrackInCrate(crateId: string, trackId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserTokens(userId: string, token: string, secret: string, username: string): Promise<void> {
    await db
      .update(users)
      .set({
        discogsToken: token,
        discogsSecret: secret,
        discogsUsername: username,
        lastImport: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async getUserReleases(userId: string): Promise<Release[]> {
    return await db.select().from(releases).where(eq(releases.userId, userId));
  }

  async createRelease(release: InsertRelease): Promise<Release> {
    const [newRelease] = await db
      .insert(releases)
      .values(release)
      .returning();
    return newRelease;
  }

  async getReleaseByDiscogsId(discogsId: number): Promise<Release | undefined> {
    const [release] = await db.select().from(releases).where(eq(releases.discogsId, discogsId));
    return release || undefined;
  }

  async getUserTracks(userId: string, filters?: {
    search?: string;
    yearFrom?: number;
    yearTo?: number;
    genre?: string;
    format?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<{ tracks: Track[]; total: number }> {
    // Build where conditions
    const whereConditions = [eq(tracks.userId, userId)];

    if (filters?.search) {
      whereConditions.push(
        or(
          ilike(tracks.title, `%${filters.search}%`),
          ilike(tracks.artist, `%${filters.search}%`),
          ilike(releases.title, `%${filters.search}%`)
        )!
      );
    }

    if (filters?.genre) {
      whereConditions.push(eq(releases.genre, filters.genre));
    }

    if (filters?.format) {
      whereConditions.push(eq(releases.format, filters.format));
    }

    // Get total count first
    const countResult = await db
      .select({ count: count(tracks.id) })
      .from(tracks)
      .innerJoin(releases, eq(tracks.releaseId, releases.id))
      .where(and(...whereConditions));

    const total = Number(countResult[0]?.count || 0);

    // Determine sorting
    const sortBy = filters?.sortBy || 'artist';
    const sortOrder = filters?.sortOrder || 'asc';
    
    let orderByClause;
    if (sortBy === 'artist') {
      orderByClause = sortOrder === 'asc' ? asc(tracks.artist) : desc(tracks.artist);
    } else if (sortBy === 'title') {
      orderByClause = sortOrder === 'asc' ? asc(tracks.title) : desc(tracks.title);
    } else if (sortBy === 'position') {
      orderByClause = sortOrder === 'asc' ? asc(tracks.position) : desc(tracks.position);
    } else if (sortBy === 'duration') {
      orderByClause = sortOrder === 'asc' ? asc(tracks.duration) : desc(tracks.duration);
    } else if (sortBy === 'bpm') {
      orderByClause = sortOrder === 'asc' ? asc(tracks.bpm) : desc(tracks.bpm);
    } else if (sortBy === 'year') {
      orderByClause = sortOrder === 'asc' ? asc(releases.year) : desc(releases.year);
    } else if (sortBy === 'genre') {
      orderByClause = sortOrder === 'asc' ? asc(releases.genre) : desc(releases.genre);
    } else if (sortBy === 'format') {
      orderByClause = sortOrder === 'asc' ? asc(releases.format) : desc(releases.format);
    } else if (sortBy === 'release') {
      orderByClause = sortOrder === 'asc' ? asc(releases.title) : desc(releases.title);
    } else {
      orderByClause = asc(tracks.artist);
    }

    // Build main query with all clauses and pagination
    const queryBuilder = db
      .select({
        id: tracks.id,
        releaseId: tracks.releaseId,
        userId: tracks.userId,
        position: tracks.position,
        title: tracks.title,
        artist: tracks.artist,
        duration: tracks.duration,
        bpm: tracks.bpm,
        createdAt: tracks.createdAt,
        releaseTitle: releases.title,
        year: releases.year,
        genre: releases.genre,
        format: releases.format,
      })
      .from(tracks)
      .innerJoin(releases, eq(tracks.releaseId, releases.id))
      .where(and(...whereConditions))
      .orderBy(orderByClause)
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);

    const results = await queryBuilder;
    
    // Transform results to include release data
    const trackResults = results.map(row => ({
      ...row,
      release: {
        title: row.releaseTitle,
        year: row.year,
        genre: row.genre,
        format: row.format,
      }
    }));

    return { tracks: trackResults as any, total };
  }

  async createTrack(track: InsertTrack): Promise<Track> {
    const [newTrack] = await db
      .insert(tracks)
      .values(track)
      .returning();
    return newTrack;
  }

  async getTracksByReleaseId(releaseId: string): Promise<Track[]> {
    return await db.select().from(tracks).where(eq(tracks.releaseId, releaseId));
  }

  async deleteUserTracks(userId: string): Promise<void> {
    await db.delete(tracks).where(eq(tracks.userId, userId));
  }

  async deleteUserReleases(userId: string): Promise<void> {
    await db.delete(releases).where(eq(releases.userId, userId));
  }

  async updateTrack(id: string, updates: Partial<Omit<Track, 'id' | 'userId' | 'releaseId' | 'createdAt'>>): Promise<Track> {
    const [updatedTrack] = await db
      .update(tracks)
      .set(updates)
      .where(eq(tracks.id, id))
      .returning();
    return updatedTrack;
  }

  async updateRelease(id: string, updates: Partial<Omit<Release, 'id' | 'userId' | 'discogsId' | 'createdAt'>>): Promise<Release> {
    const [updatedRelease] = await db
      .update(releases)
      .set(updates)
      .where(eq(releases.id, id))
      .returning();
    return updatedRelease;
  }

  async getUserGenres(userId: string): Promise<string[]> {
    const results = await db
      .selectDistinct({ genre: releases.genre })
      .from(releases)
      .where(and(eq(releases.userId, userId), isNotNull(releases.genre)))
      .orderBy(asc(releases.genre));
    
    return results.map(r => r.genre!).filter(Boolean);
  }

  async getUserCrates(userId: string): Promise<Crate[]> {
    return await db.select().from(crates).where(eq(crates.userId, userId)).orderBy(asc(crates.createdAt));
  }

  async createCrate(crate: InsertCrate): Promise<Crate> {
    const [newCrate] = await db
      .insert(crates)
      .values(crate)
      .returning();
    return newCrate;
  }

  async updateCrate(id: string, updates: Partial<Omit<Crate, 'id' | 'userId' | 'createdAt'>>): Promise<Crate> {
    const [updatedCrate] = await db
      .update(crates)
      .set(updates)
      .where(eq(crates.id, id))
      .returning();
    return updatedCrate;
  }

  async deleteCrate(id: string): Promise<void> {
    // First delete all crate-track relationships
    await db.delete(crateTracks).where(eq(crateTracks.crateId, id));
    // Then delete the crate itself
    await db.delete(crates).where(eq(crates.id, id));
  }

  async addTrackToCrate(crateId: string, trackId: string): Promise<CrateTrack> {
    // Check if track is already in crate to avoid duplicates
    const existing = await db
      .select()
      .from(crateTracks)
      .where(and(eq(crateTracks.crateId, crateId), eq(crateTracks.trackId, trackId)));
    
    if (existing.length > 0) {
      return existing[0];
    }

    const [crateTrack] = await db
      .insert(crateTracks)
      .values({ crateId, trackId })
      .returning();
    return crateTrack;
  }

  async removeTrackFromCrate(crateId: string, trackId: string): Promise<void> {
    await db
      .delete(crateTracks)
      .where(and(eq(crateTracks.crateId, crateId), eq(crateTracks.trackId, trackId)));
  }

  async getCrateTracks(crateId: string): Promise<Track[]> {
    const results = await db
      .select({
        id: tracks.id,
        releaseId: tracks.releaseId,
        userId: tracks.userId,
        position: tracks.position,
        title: tracks.title,
        artist: tracks.artist,
        duration: tracks.duration,
        bpm: tracks.bpm,
        createdAt: tracks.createdAt,
        releaseTitle: releases.title,
        year: releases.year,
        genre: releases.genre,
        format: releases.format,
      })
      .from(crateTracks)
      .innerJoin(tracks, eq(crateTracks.trackId, tracks.id))
      .innerJoin(releases, eq(tracks.releaseId, releases.id))
      .where(eq(crateTracks.crateId, crateId))
      .orderBy(asc(crateTracks.addedAt));

    // Transform results to include release data
    return results.map(row => ({
      ...row,
      release: {
        title: row.releaseTitle,
        year: row.year,
        genre: row.genre,
        format: row.format,
      }
    })) as any;
  }

  async isTrackInCrate(crateId: string, trackId: string): Promise<boolean> {
    const result = await db
      .select({ count: count() })
      .from(crateTracks)
      .where(and(eq(crateTracks.crateId, crateId), eq(crateTracks.trackId, trackId)));
    
    return (result[0]?.count || 0) > 0;
  }
}

export const storage = new DatabaseStorage();
