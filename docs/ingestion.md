# Instagram ingestion

GitHub [#2](https://github.com/ValenFelizia/instagram-to-opendesign/issues/2) implements the extraction stage. Node 20+ is required; there are no npm dependencies. Only public Instagram profiles are in scope.

Apify's maintained [Instagram Scraper](https://apify.com/apify/instagram-scraper) is called once for `details` and once for `posts`. The [Apify API](https://docs.apify.com/api/v2) runs the Actor, polls it, and reads each result dataset. `APIFY_TOKEN` is sent in an Authorization header. Two Actor runs may incur charges; the API request caps each at USD 2. The provider is isolated in `src/providers/apify.js`.

In PowerShell:

```powershell
node --env-file=.env.local bin/instagram-ingest.js '@publicusername' --posts 20
```

Create `.env.local` with `APIFY_TOKEN=<token from Apify console>` on one line. The file is ignored by Git. Node 20.6+ supports `--env-file`; on earlier Node 20 releases, set `APIFY_TOKEN` in the shell instead. In PowerShell, quote the `@username` argument so `@` is not interpreted as shell syntax.

The command writes `data/<username>/instagram-source.json` and downloaded media in `assets/`. `data/` is ignored by Git. Keep the token and real profile data out of commits. The source JSON stores remote CDN URLs for provenance; these URLs may expire, so the local assets are the reproducible evidence. Repeated runs replace the username's directory only after all assets download. A failed download leaves the previous successful run in place.

The normalized source includes profile name, bio, links, avatar, counts, post timestamps/captions/basic metrics, original `ownerUsername`, and every available carousel image/video URL plus a local file path. Posts returned in the profile feed remain included when another account is the original author (for example, collaborations); the owner field preserves that distinction. Posts are sorted by timestamp after extraction. Only image JPEG/PNG/WebP/AVIF and video MP4/WebM files from Instagram CDN hosts are downloaded; unsupported media, failed requests, or limits (60 MB each, 300 MB total) fail the run explicitly. `--posts` accepts 1–25 (default 20). The actor may return fewer posts depending on what is public. If an evidence review exists, re-ingestion preserves `evidence/review.json` but regenerates other evidence files on the next processor run.

To exercise the pipeline without Apify, use `--fixture path/to/provider-output.json`. A fixture has `{ "profile": {...}, "posts": [...], "runs": [] }` using the provider's field names; media downloads still need reachable public Instagram CDN URLs.
