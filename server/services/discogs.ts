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
    this.consumerKey = process.env.DISCOGS_CONSUMER_KEY || 'AeTnVJvayCnoxkGQZaQU';
    this.consumerSecret = process.env.DISCOGS_CONSUMER_SECRET || 'lxdpoRAHQojEViwTMPbiqkRphNWOMxDN';
  }

  async generateOAuthUrl(callbackUrl: string): Promise<{ url: string; state: string }> {
    try {
      // Generate a random state parameter for security
      const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Discogs uses OAuth 2.0 authorization code flow
      const authParams = new URLSearchParams({
        client_id: this.consumerKey,
        redirect_uri: callbackUrl,
        response_type: 'code',
        state: state,
        scope: 'r_user_library' // Request read access to user's library
      });
      
      const url = `https://www.discogs.com/oauth/authorize?${authParams.toString()}`;
      
      console.log('Generated OAuth URL:', url);
      return { url, state };
    } catch (error) {
      console.error('Error generating OAuth URL:', error);
      throw error;
    }
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<DiscogsOAuthTokens> {
    try {
      // Exchange authorization code for access token using OAuth 2.0
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: this.consumerKey,
        client_secret: this.consumerSecret
      });

      const response = await fetch('https://api.discogs.com/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'DJLibrary/1.0'
        },
        body: tokenParams.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token exchange error:', response.status, errorText);
        throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Token exchange response:', data);
      
      if (!data.access_token) {
        throw new Error('Invalid response from Discogs access token endpoint');
      }

      return {
        token: data.access_token,
        secret: '' // OAuth 2.0 doesn't use token secrets
      };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw error;
    }
  }

  async getUserCollection(token: string, username: string, page: number = 1): Promise<{
    releases: DiscogsRelease[];
    hasMore: boolean;
    total: number;
  }> {
    try {
      const response = await fetch(
        `https://api.discogs.com/users/${username}/collection/folders/0/releases?page=${page}&per_page=100`,
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
    } catch (error) {
      console.error('Error fetching collection:', error);
      throw error;
    }
  }

  async getReleaseDetails(releaseId: number, token: string): Promise<DiscogsReleaseDetails> {
    try {
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
    } catch (error) {
      console.error('Error fetching release details:', error);
      throw error;
    }
  }

  async importUserCollection(token: string, username: string, userId: string, storage: any) {
    let page = 1;
    let hasMore = true;
    let totalProcessed = 0;

    // Clear existing data
    await storage.deleteUserTracks(userId);
    await storage.deleteUserReleases(userId);

    while (hasMore) {
      const { releases, hasMore: morePages, total } = await this.getUserCollection(token, username, page);
      
      for (const release of releases) {
        try {
          // Check if release already exists
          const existingRelease = await storage.getReleaseByDiscogsId(release.id);
          
          if (!existingRelease) {
            // Get detailed release information
            const details = await this.getReleaseDetails(release.id, token);
            
            // Create release record
            const releaseRecord = await storage.createRelease({
              userId,
              discogsId: release.id,
              title: details.title,
              artist: details.artists.map(a => a.name).join(', '),
              year: details.year || null,
              genre: details.genres ? details.genres[0] : null,
              format: details.formats ? details.formats[0].name : null,
              label: details.labels ? details.labels[0].name : null,
              catno: details.labels ? details.labels[0].catno : null,
            });

            // Create track records
            if (details.tracklist) {
              for (const track of details.tracklist) {
                await storage.createTrack({
                  releaseId: releaseRecord.id,
                  userId,
                  position: track.position,
                  title: track.title,
                  artist: track.artists ? track.artists.map(a => a.name).join(', ') : details.artists.map(a => a.name).join(', '),
                  duration: track.duration || null,
                });
              }
            }
          }
          
          totalProcessed++;
          
          // Add delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error processing release ${release.id}:`, error);
          // Continue with next release
        }
      }
      
      hasMore = morePages;
      page++;
    }

    return { totalProcessed };
  }
}
