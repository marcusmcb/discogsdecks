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
      const userId = "demo-user-id"; // In real app, get from auth
      
      const searchSchema = z.object({
        search: z.string().optional(),
        yearFrom: z.string().transform(Number).optional(),
        yearTo: z.string().transform(Number).optional(),
        genre: z.string().optional(),
        format: z.string().optional(),
        sortBy: z.enum(['artist', 'title', 'year']).default('artist'),
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

  // Get library stats
  app.get("/api/stats", async (req, res) => {
    try {
      const userId = "demo-user-id";
      
      const releases = await storage.getUserReleases(userId);
      const { total: totalTracks } = await storage.getUserTracks(userId, { limit: 0 });
      
      const user = await storage.getUser(userId);
      
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
