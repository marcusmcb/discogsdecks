import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { DiscogsService } from "./services/discogs";
import { z } from "zod";

// Extend Express Session types
declare module "express-session" {
  interface SessionData {
    requestToken?: string;
    requestSecret?: string;
  }
}

const discogsService = new DiscogsService();

export async function registerRoutes(app: Express): Promise<Server> {
  // Discogs OAuth routes
  app.get("/api/auth/discogs", async (req, res) => {
    try {
      // Prevent caching
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const callbackUrl = `${req.protocol}://${req.get('host')}/api/auth/discogs/callback`;
      console.log('Initiating OAuth with callback URL:', callbackUrl);
      
      const { url, requestToken, requestSecret } = await discogsService.generateOAuthUrl(callbackUrl);
      console.log('Generated OAuth URL:', url);
      console.log('Request token:', requestToken);
      
      // Store tokens in session for later use
      req.session = req.session || {};
      req.session.requestToken = requestToken;
      req.session.requestSecret = requestSecret;
      
      res.json({ authUrl: url });
    } catch (error) {
      console.error('OAuth initiation error:', error);
      res.status(500).json({ message: "Failed to initiate OAuth", error: (error as Error).message });
    }
  });

  app.get("/api/auth/discogs/callback", async (req, res) => {
    try {
      const { oauth_token, oauth_verifier } = req.query;
      
      if (!oauth_token || !oauth_verifier) {
        return res.send(`
          <html>
            <body>
              <script>
                window.opener?.postMessage({ type: 'DISCOGS_AUTH_ERROR', error: 'Missing OAuth parameters' }, '*');
                window.close();
              </script>
              <p>Authentication failed. This window should close automatically.</p>
            </body>
          </html>
        `);
      }

      // Get stored request tokens from session
      const requestToken = req.session?.requestToken;
      const requestSecret = req.session?.requestSecret;
      
      if (!requestToken || !requestSecret) {
        throw new Error('Request token not found in session');
      }

      // Exchange verifier for access token
      const tokens = await discogsService.exchangeCodeForTokens(
        oauth_verifier as string,
        requestToken,
        requestSecret
      );
      
      // Get actual user identity from Discogs
      const identity = await discogsService.getUserIdentity(tokens.token, tokens.secret);
      
      // Try to find existing user by Discogs username
      let user = await storage.getUserByUsername(identity.username);
      
      if (!user) {
        // Create new user with actual Discogs username
        user = await storage.createUser({
          username: identity.username,
          password: "oauth-user" // Not used for OAuth flow
        });
      }
      
      // Store tokens (in production, encrypt these)
      await storage.updateUserTokens(user.id, tokens.token, tokens.secret, identity.username);
      
      // Send success message to parent window and close popup
      res.send(`
        <html>
          <body>
            <script>
              window.opener?.postMessage({ type: 'DISCOGS_AUTH_SUCCESS' }, '*');
              window.close();
            </script>
            <p>Authentication successful! This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.send(`
        <html>
          <body>
            <script>
              window.opener?.postMessage({ type: 'DISCOGS_AUTH_ERROR', error: 'OAuth callback failed' }, '*');
              window.close();
            </script>
            <p>Authentication failed. This window should close automatically.</p>
          </body>
        </html>
      `);
    }
  });

  // Token-based authentication
  app.post("/api/auth/discogs/token", async (req, res) => {
    try {
      const { username, token } = req.body;
      
      if (!username || !token) {
        return res.status(400).json({ message: "Username and token are required" });
      }

      // Test the token by making a simple API call to Discogs
      const testResponse = await fetch(`https://api.discogs.com/users/${username}`, {
        headers: {
          'Authorization': `Discogs token=${token}`,
          'User-Agent': 'DJLibrary/1.0'
        }
      });

      if (!testResponse.ok) {
        return res.status(401).json({ message: "Invalid credentials. Please check your username and token." });
      }

      // Token is valid, store it
      const userId = "demo-user-id";
      
      // Ensure demo user exists
      let user = await storage.getUser(userId);
      if (!user) {
        user = await storage.createUser({
          username: "demo-user",
          password: "temp-password"
        });
      }
      
      // Store credentials
      await storage.updateUserTokens(user.id, token, "", username);
      
      res.json({ message: "Successfully connected to Discogs" });
    } catch (error) {
      console.error('Token auth error:', error);
      res.status(500).json({ message: "Failed to connect to Discogs" });
    }
  });

  // Import collection
  app.post("/api/import", async (req, res) => {
    try {
      // For demo purposes, find the most recently authenticated user
      // In production, you'd use proper session management
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user || !user.discogsToken || !user.discogsUsername) {
        return res.status(401).json({ message: "No authenticated Discogs user found. Please connect your account first." });
      }

      // Start import process (in production, use a job queue)
      const result = await discogsService.importUserCollection(
        user.discogsToken,
        user.discogsUsername,
        user.id,
        storage
      );

      res.json({ message: "Import completed", ...result });
    } catch (error) {
      console.error('Import error:', error);
      res.status(500).json({ message: "Import failed" });
    }
  });

  // Get tracks with filtering and pagination
  app.get("/api/tracks", async (req, res) => {
    try {
      // Find the authenticated user (with Discogs tokens)
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user) {
        // No authenticated user, return empty result
        res.json({
          tracks: [],
          total: 0,
          page: 1,
          totalPages: 0,
        });
        return;
      }
      
      const userId = user.id;
      
      const searchSchema = z.object({
        search: z.string().optional(),
        yearFrom: z.string().transform(Number).optional(),
        yearTo: z.string().transform(Number).optional(),
        genre: z.string().optional(),
        format: z.string().optional(),
        sortBy: z.enum(['position', 'artist', 'title', 'release', 'year', 'genre', 'format', 'duration', 'bpm']).default('artist'),
        sortOrder: z.enum(['asc', 'desc']).default('asc'),
        page: z.string().transform(Number).default("1"),
        limit: z.string().transform(Number).default("50"),
      });

      const filters = searchSchema.parse(req.query);
      const offset = (filters.page - 1) * filters.limit;

      const result = await storage.getUserTracks(userId, {
        ...filters,
        offset,
      });

      res.json({
        tracks: result.tracks,
        total: result.total,
        page: filters.page,
        totalPages: Math.ceil(result.total / filters.limit),
      });
    } catch (error) {
      console.error('Get tracks error:', error);
      res.status(500).json({ message: "Failed to fetch tracks" });
    }
  });

  // Bulk update tracks location (MUST come before any parameterized track routes)
  console.log('📝 REGISTERING bulk-location route at line 250');
  app.patch("/api/tracks/bulk-location", async (req, res) => {
    console.log('🔥🔥🔥 BULK ROUTE DEFINITELY HIT! 🔥🔥🔥');
    console.log('🚀 REQUEST REACHED OUR HANDLER AT LINE 250! 🚀');
    try {
      console.log('ROUTE: Bulk location update request received');
      console.log('ROUTE: Request body:', req.body);
      
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user) {
        console.log('ROUTE: No authenticated user found');
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      console.log('ROUTE: Found authenticated user:', user.id);
      
      const bulkUpdateSchema = z.object({
        trackIds: z.array(z.string()),
        locationId: z.string().nullable(),
      });
      
      const { trackIds, locationId } = bulkUpdateSchema.parse(req.body);
      console.log(`ROUTE: Parsed data - ${trackIds.length} tracks, locationId: ${locationId}`);
      console.log('ROUTE: About to call storage.bulkUpdateTracksLocation');
      
      await storage.bulkUpdateTracksLocation(trackIds, locationId, user.id);
      console.log('ROUTE: Storage call completed successfully');
      
      res.json({ 
        success: true, 
        updated: trackIds.length,
        source: "REAL_BULK_HANDLER",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('ROUTE: Bulk update tracks location error:', error);
      res.status(500).json({ message: "Failed to bulk update track locations" });
    }
  });

  // Update track
  app.patch("/api/tracks/:id", async (req, res) => {
    try {
      const trackId = req.params.id;
      
      // Find the authenticated user
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Validate update data - separate track fields from release fields
      const updateSchema = z.object({
        // Track fields
        title: z.string().optional(),
        artist: z.string().optional(),
        position: z.string().optional(),
        duration: z.string().optional(),
        bpm: z.number().int().positive().optional().nullable(),
        // Release fields
        year: z.number().int().optional(),
        genre: z.string().optional(),
        format: z.string().optional(),
        release: z.string().optional(), // release title
      });
      
      const updates = updateSchema.parse(req.body);
      
      // Separate track updates from release updates
      const trackUpdates = {
        ...(updates.title && { title: updates.title }),
        ...(updates.artist && { artist: updates.artist }),
        ...(updates.position && { position: updates.position }),
        ...(updates.duration && { duration: updates.duration }),
        ...(updates.bpm !== undefined && { bpm: updates.bpm }),
      };
      
      const releaseUpdates = {
        ...(updates.year && { year: updates.year }),
        ...(updates.genre && { genre: updates.genre }),
        ...(updates.format && { format: updates.format }),
        ...(updates.release && { title: updates.release }),
      };
      
      let updatedTrack;
      
      // Update track if there are track fields to update
      if (Object.keys(trackUpdates).length > 0) {
        updatedTrack = await storage.updateTrack(trackId, trackUpdates);
      }
      
      // Update release if there are release fields to update
      if (Object.keys(releaseUpdates).length > 0) {
        // Get the track to find its release ID
        const tracks = await storage.getUserTracks(user.id, { limit: 0 });
        const track = tracks.tracks.find((t: any) => t.id === trackId);
        
        if (track) {
          await storage.updateRelease(track.releaseId, releaseUpdates);
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Update track error:', error);
      res.status(500).json({ message: "Failed to update track" });
    }
  });

  // Crate management endpoints
  
  // Get user's crates
  app.get("/api/crates", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user) {
        return res.json({ crates: [] });
      }
      
      const crates = await storage.getUserCrates(user.id);
      res.json({ crates });
    } catch (error) {
      console.error('Get crates error:', error);
      res.status(500).json({ message: "Failed to fetch crates" });
    }
  });

  // Create new crate
  app.post("/api/crates", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const createSchema = z.object({
        name: z.string().min(1, "Crate name is required"),
      });
      
      const { name } = createSchema.parse(req.body);
      
      const newCrate = await storage.createCrate({
        userId: user.id,
        name,
      });
      
      res.json({ crate: newCrate });
    } catch (error) {
      console.error('Create crate error:', error);
      res.status(500).json({ message: "Failed to create crate" });
    }
  });

  // Update crate (rename)
  app.patch("/api/crates/:id", async (req, res) => {
    try {
      const crateId = req.params.id;
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const updateSchema = z.object({
        name: z.string().min(1, "Crate name is required"),
      });
      
      const updates = updateSchema.parse(req.body);
      const updatedCrate = await storage.updateCrate(crateId, updates);
      
      res.json({ crate: updatedCrate });
    } catch (error) {
      console.error('Update crate error:', error);
      res.status(500).json({ message: "Failed to update crate" });
    }
  });

  // Delete crate
  app.delete("/api/crates/:id", async (req, res) => {
    try {
      const crateId = req.params.id;
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      await storage.deleteCrate(crateId);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete crate error:', error);
      res.status(500).json({ message: "Failed to delete crate" });
    }
  });

  // Add track to crate
  app.post("/api/crates/:id/tracks", async (req, res) => {
    try {
      const crateId = req.params.id;
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const addTrackSchema = z.object({
        trackId: z.string(),
      });
      
      const { trackId } = addTrackSchema.parse(req.body);
      const crateTrack = await storage.addTrackToCrate(crateId, trackId);
      
      res.json({ crateTrack });
    } catch (error) {
      console.error('Add track to crate error:', error);
      res.status(500).json({ message: "Failed to add track to crate" });
    }
  });

  // Remove track from crate
  app.delete("/api/crates/:id/tracks/:trackId", async (req, res) => {
    try {
      const { id: crateId, trackId } = req.params;
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      await storage.removeTrackFromCrate(crateId, trackId);
      res.json({ success: true });
    } catch (error) {
      console.error('Remove track from crate error:', error);
      res.status(500).json({ message: "Failed to remove track from crate" });
    }
  });

  // Get tracks in a crate
  app.get("/api/crates/:id/tracks", async (req, res) => {
    try {
      const crateId = req.params.id;
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user) {
        return res.json({ 
          tracks: [],
          total: 0,
          page: 1,
          totalPages: 0
        });
      }
      
      // Parse search and filter parameters
      const search = req.query.search as string;
      const yearFrom = req.query.yearFrom as string;
      const yearTo = req.query.yearTo as string;
      const genre = req.query.genre as string;
      const format = req.query.format as string;
      const sortBy = req.query.sortBy as string || 'addedAt';
      const sortOrder = req.query.sortOrder as string || 'asc';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      
      const filters = {
        search,
        yearFrom,
        yearTo,
        genre,
        format,
        sortBy,
        sortOrder,
        limit,
        offset
      };
      
      const { tracks, total } = await storage.getCrateTracks(crateId, filters);
      const totalPages = Math.ceil(total / limit);
      
      res.json({ 
        tracks, 
        total,
        page,
        totalPages 
      });
    } catch (error) {
      console.error('Get crate tracks error:', error);
      res.status(500).json({ message: "Failed to fetch crate tracks" });
    }
  });

  // Get unique genres from user's collection
  app.get("/api/genres", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user) {
        return res.json({ genres: [] });
      }
      
      const genres = await storage.getUserGenres(user.id);
      res.json({ genres });
    } catch (error) {
      console.error('Get genres error:', error);
      res.status(500).json({ message: "Failed to fetch genres" });
    }
  });

  // Location management routes
  
  // Get user locations
  app.get("/api/locations", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user) {
        return res.json({ locations: [] });
      }
      
      const locations = await storage.getUserLocations(user.id);
      res.json({ locations });
    } catch (error) {
      console.error('Get locations error:', error);
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  // Create new location
  app.post("/api/locations", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const createLocationSchema = z.object({
        name: z.string().min(1, "Location name is required"),
        color: z.string().nullable().optional(),
      });
      
      const locationData = createLocationSchema.parse(req.body);
      
      // Check if location name already exists for this user
      const existingLocation = await storage.getLocationByName(user.id, locationData.name);
      if (existingLocation) {
        return res.status(400).json({ message: "Location name already exists" });
      }
      
      // Check if color is already used by another location (if provided)
      if (locationData.color) {
        const locations = await storage.getUserLocations(user.id);
        const colorInUse = locations.some(loc => loc.color === locationData.color);
        if (colorInUse) {
          return res.status(400).json({ message: "Color already assigned to another location" });
        }
      }
      
      const newLocation = await storage.createLocation({
        userId: user.id,
        ...locationData,
      });
      
      res.json({ location: newLocation });
    } catch (error) {
      console.error('Create location error:', error);
      res.status(500).json({ message: "Failed to create location" });
    }
  });

  // Update location
  app.patch("/api/locations/:id", async (req, res) => {
    try {
      const locationId = req.params.id;
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const updateLocationSchema = z.object({
        name: z.string().min(1).optional(),
        color: z.string().nullable().optional(),
      });
      
      const updates = updateLocationSchema.parse(req.body);
      
      // Check if new name already exists (if name is being updated)
      if (updates.name) {
        const existingLocation = await storage.getLocationByName(user.id, updates.name);
        if (existingLocation && existingLocation.id !== locationId) {
          return res.status(400).json({ message: "Location name already exists" });
        }
      }
      
      // Check if new color is already used (if color is being updated)
      if (updates.color) {
        const locations = await storage.getUserLocations(user.id);
        const colorInUse = locations.some(loc => loc.color === updates.color && loc.id !== locationId);
        if (colorInUse) {
          return res.status(400).json({ message: "Color already assigned to another location" });
        }
      }
      
      const updatedLocation = await storage.updateLocation(locationId, updates);
      res.json({ location: updatedLocation });
    } catch (error) {
      console.error('Update location error:', error);
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  // Delete location
  app.delete("/api/locations/:id", async (req, res) => {
    try {
      const locationId = req.params.id;
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Get the location to check if it's the "Main" location
      const locations = await storage.getUserLocations(user.id);
      const locationToDelete = locations.find(loc => loc.id === locationId);
      
      if (!locationToDelete) {
        return res.status(404).json({ message: "Location not found" });
      }
      
      // Prevent deletion of "Main" location
      if (locationToDelete.name === "Main") {
        return res.status(400).json({ message: "Cannot delete the Main location" });
      }
      
      await storage.deleteLocation(locationId);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete location error:', error);
      res.status(500).json({ message: "Failed to delete location" });
    }
  });


  // Update individual track location
  app.patch("/api/tracks/:id/location", async (req, res) => {
    try {
      const trackId = req.params.id;
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const updateTrackLocationSchema = z.object({
        locationId: z.string().nullable(),
      });
      
      const { locationId } = updateTrackLocationSchema.parse(req.body);
      
      const updatedTrack = await storage.updateTrackLocation(trackId, locationId);
      res.json({ track: updatedTrack });
    } catch (error) {
      console.error('Update track location error:', error);
      res.status(500).json({ message: "Failed to update track location" });
    }
  });

  // Get library stats
  app.get("/api/stats", async (req, res) => {
    try {
      // Find the authenticated user (with Discogs tokens)
      const users = await storage.getAllUsers();
      const user = users.find((u: any) => u.discogsToken && u.discogsUsername);
      
      if (!user) {
        // No authenticated user found
        res.json({
          totalTracks: 0,
          totalReleases: 0,
          lastUpdated: null,
          connected: false,
        });
        return;
      }
      
      const releases = await storage.getUserReleases(user.id);
      const { total: totalTracks } = await storage.getUserTracks(user.id, { limit: 0 });
      
      res.json({
        totalTracks,
        totalReleases: releases.length,
        lastUpdated: user?.lastImport || null,
        connected: !!(user?.discogsToken),
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
