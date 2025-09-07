import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  discogsToken: text("discogs_token"),
  discogsSecret: text("discogs_secret"),
  discogsUsername: text("discogs_username"),
  lastImport: timestamp("last_import"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const releases = pgTable("releases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  discogsId: integer("discogs_id").notNull().unique(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  year: integer("year"),
  genre: text("genre"),
  format: text("format"),
  label: text("label"),
  catno: text("catno"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tracks = pgTable("tracks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  releaseId: varchar("release_id").notNull(),
  userId: varchar("user_id").notNull(),
  locationId: varchar("location_id"), // Optional reference to location
  position: text("position"),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  duration: text("duration"),
  bpm: integer("bpm"), // BPM field for beats per minute, nullable by default
  createdAt: timestamp("created_at").defaultNow(),
});

export const crates = pgTable("crates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const locations = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  color: text("color"), // Optional hex color code
  createdAt: timestamp("created_at").defaultNow(),
});

export const crateTracks = pgTable("crate_tracks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  crateId: varchar("crate_id").notNull(),
  trackId: varchar("track_id").notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  releases: many(releases),
  tracks: many(tracks),
  crates: many(crates),
  locations: many(locations),
}));

export const releasesRelations = relations(releases, ({ one, many }) => ({
  user: one(users, {
    fields: [releases.userId],
    references: [users.id],
  }),
  tracks: many(tracks),
}));

export const tracksRelations = relations(tracks, ({ one, many }) => ({
  user: one(users, {
    fields: [tracks.userId],
    references: [users.id],
  }),
  release: one(releases, {
    fields: [tracks.releaseId],
    references: [releases.id],
  }),
  location: one(locations, {
    fields: [tracks.locationId],
    references: [locations.id],
  }),
  crateTracks: many(crateTracks),
}));

export const cratesRelations = relations(crates, ({ one, many }) => ({
  user: one(users, {
    fields: [crates.userId],
    references: [users.id],
  }),
  crateTracks: many(crateTracks),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  user: one(users, {
    fields: [locations.userId],
    references: [users.id],
  }),
  tracks: many(tracks),
}));

export const crateTracksRelations = relations(crateTracks, ({ one }) => ({
  crate: one(crates, {
    fields: [crateTracks.crateId],
    references: [crates.id],
  }),
  track: one(tracks, {
    fields: [crateTracks.trackId],
    references: [tracks.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertReleaseSchema = createInsertSchema(releases).omit({
  id: true,
  createdAt: true,
});

export const insertTrackSchema = createInsertSchema(tracks).omit({
  id: true,
  createdAt: true,
});

export const insertCrateSchema = createInsertSchema(crates).omit({
  id: true,
  createdAt: true,
});

export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
  createdAt: true,
});

export const insertCrateTrackSchema = createInsertSchema(crateTracks).omit({
  id: true,
  addedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertRelease = z.infer<typeof insertReleaseSchema>;
export type Release = typeof releases.$inferSelect;
export type InsertTrack = z.infer<typeof insertTrackSchema>;
export type Track = typeof tracks.$inferSelect;
export type InsertCrate = z.infer<typeof insertCrateSchema>;
export type Crate = typeof crates.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;
export type InsertCrateTrack = z.infer<typeof insertCrateTrackSchema>;
export type CrateTrack = typeof crateTracks.$inferSelect;
