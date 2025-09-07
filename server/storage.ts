import { users, releases, tracks, crates, crateTracks, locations, type User, type InsertUser, type Release, type InsertRelease, type Track, type InsertTrack, type Crate, type InsertCrate, type CrateTrack, type InsertCrateTrack, type Location, type InsertLocation } from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, or, desc, asc, sql, count, isNotNull, gte, lte, inArray } from "drizzle-orm";

interface TrackFilters {
  search?: string;
  yearFrom?: string;
  yearTo?: string;  
  genre?: string;
  format?: string;
  sortBy?: string;
  sortOrder?: string;
  limit?: number;
  offset?: number;
}

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
  getCrateTracks(crateId: string, filters?: TrackFilters): Promise<{ tracks: Track[], total: number }>;
  isTrackInCrate(crateId: string, trackId: string): Promise<boolean>;
  
  // Location management
  getUserLocations(userId: string): Promise<Location[]>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: string, updates: Partial<Omit<Location, 'id' | 'userId' | 'createdAt'>>): Promise<Location>;
  deleteLocation(id: string): Promise<void>;
  getLocationByName(userId: string, name: string): Promise<Location | undefined>;
  getMainLocation(userId: string): Promise<Location>;
  updateTrackLocation(trackId: string, locationId: string | null): Promise<Track>;
  bulkUpdateTracksLocation(trackIds: string[], locationId: string | null, userId: string): Promise<void>;
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
        locationId: tracks.locationId,
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
        locationName: locations.name,
        locationColor: locations.color,
      })
      .from(tracks)
      .innerJoin(releases, eq(tracks.releaseId, releases.id))
      .leftJoin(locations, eq(tracks.locationId, locations.id))
      .where(and(...whereConditions))
      .orderBy(orderByClause)
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);

    const results = await queryBuilder;
    
    // Transform results to include release and location data
    const trackResults = results.map(row => ({
      ...row,
      release: {
        title: row.releaseTitle,
        year: row.year,
        genre: row.genre,
        format: row.format,
      },
      location: row.locationName ? {
        name: row.locationName,
        color: row.locationColor,
      } : null
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

  async getCrateTracks(crateId: string, filters?: TrackFilters): Promise<{ tracks: Track[], total: number }> {
    // Build WHERE conditions
    const whereConditions = [eq(crateTracks.crateId, crateId)];

    // Add search filter
    if (filters?.search) {
      const searchTerm = `%${filters.search.toLowerCase()}%`;
      whereConditions.push(
        or(
          ilike(tracks.artist, searchTerm),
          ilike(tracks.title, searchTerm),
          ilike(releases.title, searchTerm)
        )!
      );
    }

    // Add year filters
    if (filters?.yearFrom) {
      whereConditions.push(gte(releases.year, parseInt(filters.yearFrom)));
    }
    if (filters?.yearTo) {
      whereConditions.push(lte(releases.year, parseInt(filters.yearTo)));
    }

    // Add genre filter
    if (filters?.genre) {
      whereConditions.push(eq(releases.genre, filters.genre));
    }

    // Add format filter  
    if (filters?.format) {
      whereConditions.push(eq(releases.format, filters.format));
    }

    // Build the combined WHERE condition
    const whereCondition = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    // Get total count
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(crateTracks)
      .innerJoin(tracks, eq(crateTracks.trackId, tracks.id))
      .innerJoin(releases, eq(tracks.releaseId, releases.id))
      .where(whereCondition);

    // Add sorting
    let orderByClause;
    const sortBy = filters?.sortBy || 'addedAt';
    const sortOrder = filters?.sortOrder || 'asc';
    
    switch (sortBy) {
      case 'artist':
        orderByClause = sortOrder === 'desc' ? desc(tracks.artist) : asc(tracks.artist);
        break;
      case 'title':
        orderByClause = sortOrder === 'desc' ? desc(tracks.title) : asc(tracks.title);
        break;
      case 'release':
        orderByClause = sortOrder === 'desc' ? desc(releases.title) : asc(releases.title);
        break;
      case 'year':
        orderByClause = sortOrder === 'desc' ? desc(releases.year) : asc(releases.year);
        break;
      case 'genre':
        orderByClause = sortOrder === 'desc' ? desc(releases.genre) : asc(releases.genre);
        break;
      case 'format':
        orderByClause = sortOrder === 'desc' ? desc(releases.format) : asc(releases.format);
        break;
      case 'duration':
        orderByClause = sortOrder === 'desc' ? desc(tracks.duration) : asc(tracks.duration);
        break;
      case 'bpm':
        orderByClause = sortOrder === 'desc' ? desc(tracks.bpm) : asc(tracks.bpm);
        break;
      case 'position':
        orderByClause = sortOrder === 'desc' ? desc(tracks.position) : asc(tracks.position);
        break;
      case 'addedAt':
      default:
        orderByClause = sortOrder === 'desc' ? desc(crateTracks.addedAt) : asc(crateTracks.addedAt);
        break;
    }

    // Build main query with all conditions  
    const queryBuilder = db
      .select({
        id: tracks.id,
        releaseId: tracks.releaseId,
        userId: tracks.userId,
        locationId: tracks.locationId,
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
        locationName: locations.name,
        locationColor: locations.color,
      })
      .from(crateTracks)
      .innerJoin(tracks, eq(crateTracks.trackId, tracks.id))
      .innerJoin(releases, eq(tracks.releaseId, releases.id))
      .leftJoin(locations, eq(tracks.locationId, locations.id))
      .where(whereCondition)
      .orderBy(orderByClause);

    // Apply pagination if provided
    const finalQuery = filters?.limit ? 
      (filters?.offset ? queryBuilder.limit(filters.limit).offset(filters.offset) : queryBuilder.limit(filters.limit)) :
      (filters?.offset ? queryBuilder.offset(filters.offset) : queryBuilder);

    const results = await finalQuery;
    
    // Transform results to include release and location data
    const trackResults = results.map(row => ({
      ...row,
      release: {
        title: row.releaseTitle,
        year: row.year,
        genre: row.genre,
        format: row.format,
      },
      location: row.locationName ? {
        name: row.locationName,
        color: row.locationColor,
      } : null
    }));

    return { tracks: trackResults as any, total };
  }

  async isTrackInCrate(crateId: string, trackId: string): Promise<boolean> {
    const result = await db
      .select({ count: count() })
      .from(crateTracks)
      .where(and(eq(crateTracks.crateId, crateId), eq(crateTracks.trackId, trackId)));
    
    return (result[0]?.count || 0) > 0;
  }

  // Location management methods
  async getUserLocations(userId: string): Promise<Location[]> {
    return await db.select().from(locations).where(eq(locations.userId, userId)).orderBy(asc(locations.name));
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const [newLocation] = await db
      .insert(locations)
      .values(location)
      .returning();
    return newLocation;
  }

  async updateLocation(id: string, updates: Partial<Omit<Location, 'id' | 'userId' | 'createdAt'>>): Promise<Location> {
    const [updatedLocation] = await db
      .update(locations)
      .set(updates)
      .where(eq(locations.id, id))
      .returning();
    return updatedLocation;
  }

  async deleteLocation(id: string): Promise<void> {
    // First, set all tracks in this location to null (no location)
    await db
      .update(tracks)
      .set({ locationId: null })
      .where(eq(tracks.locationId, id));
    
    // Then delete the location
    await db.delete(locations).where(eq(locations.id, id));
  }

  async getLocationByName(userId: string, name: string): Promise<Location | undefined> {
    const [location] = await db
      .select()
      .from(locations)
      .where(and(eq(locations.userId, userId), eq(locations.name, name)));
    return location || undefined;
  }

  async getMainLocation(userId: string): Promise<Location> {
    // Try to find existing "Main" location
    let mainLocation = await this.getLocationByName(userId, "Main");
    
    // If no "Main" location exists, create it
    if (!mainLocation) {
      mainLocation = await this.createLocation({
        userId,
        name: "Main",
        color: null
      });
    }
    
    return mainLocation;
  }

  async updateTrackLocation(trackId: string, locationId: string | null): Promise<Track> {
    const [updatedTrack] = await db
      .update(tracks)
      .set({ locationId })
      .where(eq(tracks.id, trackId))
      .returning();
    return updatedTrack;
  }

  async bulkUpdateTracksLocation(trackIds: string[], locationId: string | null, userId: string): Promise<void> {
    // Update multiple tracks at once using IN clause, but only for tracks owned by the user
    if (trackIds.length > 0) {
      console.log(`Bulk updating ${trackIds.length} tracks for user ${userId} with locationId: ${locationId}`);
      console.log('Track IDs:', trackIds.slice(0, 5)); // Log first 5 track IDs for debugging
      
      const result = await db
        .update(tracks)
        .set({ locationId })
        .where(and(inArray(tracks.id, trackIds), eq(tracks.userId, userId)))
        .returning({ id: tracks.id, locationId: tracks.locationId });
      
      console.log(`Successfully updated ${result.length} tracks`);
      if (result.length > 0) {
        console.log('Sample updated track:', result[0]);
      }
    }
  }
}

export const storage = new DatabaseStorage();
