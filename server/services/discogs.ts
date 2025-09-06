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

  generateOAuthUrl(callbackUrl: string): { url: string; requestToken: string; requestSecret: string } {
    // For simplicity, we'll use a simplified OAuth flow
    // In production, you'd want to implement the full OAuth 1.0a flow
    const requestToken = crypto.randomBytes(32).toString('hex');
    const requestSecret = crypto.randomBytes(32).toString('hex');
    
    const url = `https://www.discogs.com/oauth/authorize?client_id=${this.consumerKey}&redirect_uri=${encodeURIComponent(callbackUrl)}`;
    
    return { url, requestToken, requestSecret };
  }

  async exchangeCodeForTokens(code: string): Promise<DiscogsOAuthTokens> {
    // In a real implementation, you would exchange the authorization code for access tokens
    // For now, we'll simulate this with the code as the token
    return {
      token: code,
      secret: crypto.randomBytes(32).toString('hex')
    };
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
