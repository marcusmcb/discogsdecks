## ORIGINAL QUERY

I'm looking for insight on an interesting developer conundrum that I'm currently dealing with on one of my project ideas.

The project "idea" is essentially a track-level organizer, similar to that seen in DJ software such as Serato or Traktor or Rekordbox, that imports a user's Discogs collection data at a track level.

I have a working prototype of this up and running via a Replit project.  The one handicap that has barred me from developing this idea further concerns the rate limitations involved with Discogs' API.

The way this app works:

1. The user signs up and creates and account.

2. The user then authorizes the app with their Discogs account.

3. Once authorized, the track organizer app that I'm building imports the user's Discogs collection data at a track level.  Meaning, it retrieves their master list of "releases" in Discogs and then retrieves the detailed track data for each "release" in their collection.

4. Once imported, the UI then displays that data to the user, allowing them to filter and sort at a track level by title, artist, release date, etc.

This working prototype works very nicely with one very noticeable limitation: the rate limiting on Discogs' API.

Per their own documentation:

Requests are throttled by the server by source IP to 60 per minute for authenticated requests, and 25 per minute for unauthenticated requests, with some exceptions.

Your application should identify itself to our servers via a unique user agent string in order to achieve the maximum number of requests per minute.

Our rate limiting tracks your requests using a moving average over a 60 second window. If no requests are made in 60 seconds, your window will reset.

We attach the following headers to responses to help you track your rate limit use:

X-Discogs-Ratelimit: The total number of requests you can make in a one minute window.

X-Discogs-Ratelimit-Used : The number of requests you’ve made in your existing rate limit window.

X-Discogs-Ratelimit-Remaining: The number of remaining requests you are able to make in the existing rate limit window.

Your application should take our global limit into account and throttle its requests locally.

In the future, we may update these rate limits at any time in order to provide service for all users.

The problem this creates is that any time the user imports or refreshes their Discogs data within the app,  it's an agonizingly slow process given the rate limitations involved since retrieving the track data for each release in the collection can take some time for users with larger collections.  I've been testing this app with my own logged Discogs collection of 551 releases and it's notably time consuming.

I'm curious if there is any way to expedite the response from Discogs or to retrieve this data in a better way.

I ask because I recently crossed paths with an online service named Waxlog that seems to accomplish this very nicely.  

Their website can be found at https://www.waxlog.com/

After linking my Discogs data with the service, their website had my entire collection imported and available in just moments, complete with the detailed data for each track in my collection (track list, release year, label, etc).

Is there a better way to retrieve this data in a way that's as quick and seamless as Waxlog?  Does Waxlog have an agreement of sorts with Discogs that would allow them to bypass the restrictive limitations I shared with you previously?

## ORIGINAL RESPONSE FROM GPT 5.2

Thought for 27s

You’re running into the “Discogs shape mismatch” problem: a user’s collection is easy to enumerate, but tracklists are stored on the Release/Master objects, which (with the public API) usually means one extra request per release → and at ~60 authenticated requests/min per source IP that becomes minutes-to-hours for big collections. 
Spoken Like a Geek
+1

The key insight: Waxlog probably isn’t “faster at the API”

From what Waxlog publicly states, it “uses Discogs’ API” and is “not affiliated with, sponsored or endorsed by Discogs.” That doesn’t read like a special partnership that bypasses limits. 
waxlog.com
+1

What does explain the “import in moments” experience is one (or a combination) of these common strategies:

Pre-seeded local Discogs database (the big one)
Discogs publishes monthly data dumps of Releases/Masters/Artists/Labels in XML, “formatted according to the API spec,” under CC0. 
discogs-data-dumps.s3.us-west-2.amazonaws.com

If Waxlog keeps a local copy of Releases/Masters (including tracklists), then a “Discogs import” is mostly:

fetch the user’s collection release IDs (small number of API calls), then

join those IDs against their local DB (fast).

That can genuinely feel “instant” even for 500–5,000 releases.

Aggressive cross-user caching
Even without full dumps, a service can cache every release it ever fetches. Once the service has already fetched Release 12345 for any user, the next user who owns that release gets it from cache (zero Discogs calls).

Background jobs + progressive UI
They may start showing your collection immediately (from lightweight collection endpoints / cached release summaries) and fill in tracklists asynchronously, so it feels instant even if it’s still syncing.

IP-level scaling (possible, but not the main lever)
Because rate limiting is “by source IP” 
Spoken Like a Geek
, a hosted service can spread load across multiple egress IPs. That can help throughput, but it’s operationally heavier and (depending on Discogs’ ToS interpretation) can be risky if used specifically to evade throttles. The “data dump + join” approach is cleaner and more defensible.

What you can do to get Waxlog-like speed (without needing special Discogs access)
Option A (best): Use Discogs data dumps as your tracklist source

Workflow

Use the Discogs API only to fetch the user’s collection list (release IDs + metadata).

Pull tracklists/labels/years/etc from your own DB built from the monthly dumps. 
discogs-data-dumps.s3.us-west-2.amazonaws.com

Why it works

Your sync time becomes “API calls to enumerate collection” rather than “API calls per release”.

You’re no longer bound by 60/min for tracklists.

Tradeoffs

You’re now running a real ingestion pipeline (download dump, parse XML, store in Postgres/Elastic/etc).

You need a plan for updates (monthly refresh is often fine for this use case).

Option B: Hybrid cache-first API sync

If you don’t want to ingest full dumps yet:

Maintain a releases table keyed by discogs_release_id.

On import, dedupe release IDs and only fetch missing ones from Discogs; everything else comes from cache.

Over time, your cache coverage gets very high, and imports get fast for most users.

Option C: Make the “slow” import feel fast

Even if you still must fetch per-release tracklists:

Queue the import as a background job

Show partial results ASAP (e.g., the collection list + basic metadata)

Fetch tracklists in priority order (recently added / most played / user-selected folders first)

Persist progress so a refresh resumes instead of restarting

Does Waxlog have a special rate-limit agreement?

Nothing on their public site suggests that. They explicitly disclaim affiliation/endorsement and simply state they use the API. 
waxlog.com

So the most likely explanation is local data (dumps) and/or caching, not privileged Discogs limits.

If you tell me what you’re using for persistence right now (Postgres? Mongo? SQLite?) and where you plan to host (Replit / AWS / etc.), I can outline a concrete “v1 pipeline” for Option A (dumps → parser → DB schema → import join) that’s sized for an indie project rather than an enterprise data warehouse.