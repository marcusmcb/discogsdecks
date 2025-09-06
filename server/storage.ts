import { users, releases, tracks, type User, type InsertUser, type Release, type InsertRelease, type Track, type InsertTrack } from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, or, desc, asc, sql, count } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
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
  getTracksByReleaseId(releaseId: string): Promise<Track[]>;
  deleteUserTracks(userId: string): Promise<void>;
  deleteUserReleases(userId: string): Promise<void>;
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

    // Build main query
    let query = db
      .select({
        id: tracks.id,
        releaseId: tracks.releaseId,
        userId: tracks.userId,
        position: tracks.position,
        title: tracks.title,
        artist: tracks.artist,
        duration: tracks.duration,
        createdAt: tracks.createdAt,
        releaseTitle: releases.title,
        year: releases.year,
        genre: releases.genre,
        format: releases.format,
      })
      .from(tracks)
      .innerJoin(releases, eq(tracks.releaseId, releases.id))
      .where(and(...whereConditions));

    // Apply sorting
    const sortBy = filters?.sortBy || 'artist';
    const sortOrder = filters?.sortOrder || 'asc';
    
    if (sortBy === 'artist') {
      query = query.orderBy(sortOrder === 'asc' ? asc(tracks.artist) : desc(tracks.artist));
    } else if (sortBy === 'title') {
      query = query.orderBy(sortOrder === 'asc' ? asc(tracks.title) : desc(tracks.title));
    } else if (sortBy === 'year') {
      query = query.orderBy(sortOrder === 'asc' ? asc(releases.year) : desc(releases.year));
    }

    // Apply pagination
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    const results = await query;
    
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
}

export const storage = new DatabaseStorage();
