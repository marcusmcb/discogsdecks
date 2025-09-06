import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { DiscogsService } from "./services/discogs";
import { z } from "zod";

// Extend Express Request type to include session
declare global {
  namespace Express {
    interface Request {
      session: any;
    }
  }
}

const discogsService = new DiscogsService();

export async function registerRoutes(app: Express): Promise<Server> {
  // Discogs OAuth routes
  app.get("/api/auth/discogs", async (req, res) => {
    try {
      const callbackUrl = `${req.protocol}://${req.get('host')}/api/auth/discogs/callback`;
      const { url, requestToken, requestSecret } = discogsService.generateOAuthUrl(callbackUrl);
      
      // Store tokens in session or temporary storage
      req.session = req.session || {};
      req.session.requestToken = requestToken;
      req.session.requestSecret = requestSecret;
      
      res.json({ authUrl: url });
    } catch (error) {
      console.error('OAuth initiation error:', error);
      res.status(500).json({ message: "Failed to initiate OAuth" });
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

      const tokens = await discogsService.exchangeCodeForTokens(oauth_verifier as string);
      
      // In a real app, you'd associate this with the logged-in user
      // For demo purposes, we'll use a hardcoded user ID
      const userId = "demo-user-id";
      
      // Store tokens (in production, encrypt these)
      await storage.updateUserTokens(userId, tokens.token, tokens.secret, "demo-username");
      
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

  // Import collection
  app.post("/api/import", async (req, res) => {
    try {
      // In a real app, get user ID from session/auth
      const userId = "demo-user-id";
      
      const user = await storage.getUser(userId);
      if (!user || !user.discogsToken || !user.discogsUsername) {
        return res.status(401).json({ message: "User not connected to Discogs" });
      }

      // Start import process (in production, use a job queue)
      const result = await discogsService.importUserCollection(
        user.discogsToken,
        user.discogsUsername,
        userId,
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
