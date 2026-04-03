import crypto from 'crypto';

interface DiscogsOAuthTokens {
  token: string;
  secret: string;
}

interface DiscogsRelease {
  id: number;
  basic_information: {
    title: string;
    artists: Array<{ name: string }>;
    year?: number;
    genres?: string[];
    formats?: Array<{ name: string }>;
    labels?: Array<{ name: string; catno?: string }>;
  };
}

interface DiscogsReleaseDetails {
  id: number;
  title: string;
  artists: Array<{ name: string }>;
  year?: number;
  genres?: string[];
  formats?: Array<{ name: string }>;
  labels?: Array<{ name: string; catno?: string }>;
  tracklist?: Array<{
    position: string;
    title: string;
    duration?: string;
    artists?: Array<{ name: string }>;
  }>;
}

export class DiscogsService {
  private consumerKey: string;
  private consumerSecret: string;

  constructor() {
    this.consumerKey = process.env.DISCOGS_CONSUMER_KEY || "";
    this.consumerSecret = process.env.DISCOGS_CONSUMER_SECRET || "";

    if (!this.consumerKey || !this.consumerSecret) {
      throw new Error(
        "Missing Discogs app credentials. Set DISCOGS_CONSUMER_KEY and DISCOGS_CONSUMER_SECRET in your environment (e.g., in a local .env file).",
      );
    }
  }

  async generateOAuthUrl(callbackUrl: string): Promise<{ url: string; requestToken: string; requestSecret: string }> {
    try {
      // Step 1: Get request token from Discogs using OAuth 1.0a
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = Math.random().toString(36).substring(2, 15);
      
      // Build Authorization header exactly as per Discogs documentation
      const authHeader = `OAuth oauth_consumer_key="${this.consumerKey}", oauth_nonce="${nonce}", oauth_signature="${this.consumerSecret}&", oauth_signature_method="PLAINTEXT", oauth_timestamp="${timestamp}", oauth_callback="${encodeURIComponent(callbackUrl)}"`;
      
      const response = await fetch('https://api.discogs.com/oauth/request_token', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader,
          'User-Agent': 'DJLibrary/1.0'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Discogs request token error:', response.status, errorText);
        throw new Error(`Failed to get request token: ${response.status} - ${errorText}`);
      }

      const responseText = await response.text();
      console.log('Discogs request token response:', responseText);
      const params = new URLSearchParams(responseText);
      
      const requestToken = params.get('oauth_token');
      const requestSecret = params.get('oauth_token_secret');
      
      if (!requestToken || !requestSecret) {
        throw new Error('Invalid response from Discogs request token endpoint');
      }

      // Step 2: Generate authorization URL with oauth_token
      const url = `https://www.discogs.com/oauth/authorize?oauth_token=${requestToken}`;
      
      console.log('Generated OAuth URL:', url);
      return { url, requestToken, requestSecret };
    } catch (error) {
      console.error('Error generating OAuth URL:', error);
      throw error;
    }
  }

  async exchangeCodeForTokens(verifier: string, requestToken: string, requestSecret: string): Promise<DiscogsOAuthTokens> {
    try {
      // Step 3: Exchange verifier for access token using OAuth 1.0a
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = Math.random().toString(36).substring(2, 15);
      
      // Build Authorization header exactly as per Discogs documentation
      // For access token, signature = consumer_secret&request_token_secret
      const authHeader = `OAuth oauth_consumer_key="${this.consumerKey}", oauth_nonce="${nonce}", oauth_token="${requestToken}", oauth_signature="${this.consumerSecret}&${requestSecret}", oauth_signature_method="PLAINTEXT", oauth_timestamp="${timestamp}", oauth_verifier="${verifier}"`;

      const response = await fetch('https://api.discogs.com/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader,
          'User-Agent': 'DJLibrary/1.0'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token exchange error:', response.status, errorText);
        throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
      }

      const responseText = await response.text();
      console.log('Token exchange response:', responseText);
      const params = new URLSearchParams(responseText);
      
      const accessToken = params.get('oauth_token');
      const accessSecret = params.get('oauth_token_secret');
      
      if (!accessToken || !accessSecret) {
        throw new Error('Invalid response from Discogs access token endpoint');
      }

      return {
        token: accessToken,
        secret: accessSecret
      };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw error;
    }
  }

  async getUserIdentity(token: string, secret: string): Promise<{ username: string; id: number }> {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = Math.random().toString(36).substring(2, 15);
      
      // Build Authorization header for authenticated requests
      const authHeader = `OAuth oauth_consumer_key="${this.consumerKey}", oauth_nonce="${nonce}", oauth_token="${token}", oauth_signature="${this.consumerSecret}&${secret}", oauth_signature_method="PLAINTEXT", oauth_timestamp="${timestamp}"`;
      
      const response = await fetch('https://api.discogs.com/oauth/identity', {
        headers: {
          'Authorization': authHeader,
          'User-Agent': 'DJLibrary/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get user identity: ${response.status}`);
      }

      const data = await response.json();
      return {
        username: data.username,
        id: data.id
      };
    } catch (error) {
      console.error('Error getting user identity:', error);
      throw error;
    }
  }

  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        if (error.message.includes('429') && attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
          console.log(`Rate limited, retrying in ${backoffMs}ms... (attempt ${attempt}/${maxRetries})`);
          await this.delay(backoffMs);
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  }

  async getUserCollection(token: string, username: string, page: number = 1): Promise<{
    releases: DiscogsRelease[];
    hasMore: boolean;
    total: number;
  }> {
    return await this.retryWithBackoff(async () => {
      // Rate limit: wait 1 second between collection requests
      await this.delay(1000);
      
      const response = await fetch(
        `https://api.discogs.com/users/${username}/collection/folders/0/releases?page=${page}&per_page=50`,
        {
          headers: {
            'Authorization': `Discogs token=${token}`,
            'User-Agent': 'DJLibrary/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Discogs API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        releases: data.releases || [],
        hasMore: data.pagination ? data.pagination.page < data.pagination.pages : false,
        total: data.pagination ? data.pagination.items : 0
      };
    });
  }

  async getReleaseDetails(releaseId: number, token: string): Promise<DiscogsReleaseDetails> {
    return await this.retryWithBackoff(async () => {
      // Rate limit: wait 2 seconds between release detail requests  
      await this.delay(2000);
      
      const response = await fetch(
        `https://api.discogs.com/releases/${releaseId}`,
        {
          headers: {
            'Authorization': `Discogs token=${token}`,
            'User-Agent': 'DJLibrary/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Discogs API error: ${response.status}`);
      }

      return await response.json();
    });
  }

  async importUserCollection(token: string, username: string, userId: string, storage: any) {
    let page = 1;
    let hasMore = true;
    let totalProcessed = 0;
    let catalogHits = 0;
    let catalogMisses = 0;

    // Clear existing data
    await storage.deleteUserTracks(userId);
    await storage.deleteUserReleases(userId);

    // Ensure user has a "Main" location and get its ID
    const mainLocation = await storage.getMainLocation(userId);

    while (hasMore) {
      const { releases, hasMore: morePages, total } = await this.getUserCollection(token, username, page);
      
      for (const release of releases) {
        try {
          // Check if release already exists
          const existingRelease = await storage.getReleaseByDiscogsId(userId, release.id);
          
          if (!existingRelease) {
            // Prefer shared catalog cache to avoid per-release Discogs API calls.
            let details = await storage.getDiscogsCatalogRelease(release.id);

            if (details) {
              catalogHits++;
            } else {
              catalogMisses++;
              const apiDetails = await this.getReleaseDetails(release.id, token);
              // Normalize to our cache shape.
              details = await storage.upsertDiscogsCatalogRelease({
                discogsId: apiDetails.id,
                title: apiDetails.title,
                artists: apiDetails.artists.map((a) => a.name).join(", "),
                year: apiDetails.year || null,
                genres: apiDetails.genres || [],
                formats: (apiDetails.formats || []).map((f) => f.name),
                labels: (apiDetails.labels || []).map((l) => ({
                  name: l.name,
                  catno: l.catno,
                })),
                tracklist: (apiDetails.tracklist || []).map((t) => ({
                  position: t.position,
                  title: t.title,
                  duration: t.duration,
                  artists: t.artists ? t.artists.map((a) => a.name) : undefined,
                })),
              });
            }
            
            // Create release record
            const releaseRecord = await storage.createRelease({
              userId,
              discogsId: release.id,
              title: details.title,
              artist: details.artists,
              year: details.year || null,
              genre: details.genres && details.genres.length > 0 ? details.genres[0] : null,
              format: details.formats && details.formats.length > 0 ? details.formats[0] : null,
              label: details.labels && details.labels.length > 0 ? details.labels[0].name : null,
              catno: details.labels && details.labels.length > 0 ? details.labels[0].catno : null,
            });

            // Create track records
            if (details.tracklist && details.tracklist.length > 0) {
              for (const track of details.tracklist) {
                await storage.createTrack({
                  releaseId: releaseRecord.id,
                  userId,
                  locationId: mainLocation.id, // Assign to Main location by default
                  position: track.position,
                  title: track.title,
                  artist: track.artists && track.artists.length > 0 ? track.artists.join(", ") : details.artists,
                  duration: track.duration || null,
                });
              }
            }
          }
          
          totalProcessed++;
          console.log(`Processed ${totalProcessed} releases...`);
        } catch (error) {
          console.error(`Error processing release ${release.id}:`, error);
          // Continue with next release
        }
      }
      
      hasMore = morePages;
      page++;
    }

    return { totalProcessed, catalogHits, catalogMisses };
  }
}
