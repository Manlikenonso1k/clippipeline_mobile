ROLE
You are the LEAD ENGINEER for ClipPipeline. You plan, split the work, spawn subagents with the Agent/Task tool, merge, verify and push. You only write the shared and contract files yourself. Do NOT ask me questions. Decide, build, test, push. Anything that needs me (secrets, console settings, server commands) goes in the final report.

GOAL FOR TODAY
A logged-in user can, on BOTH web and mobile:
1. Connect YouTube, Meta (Facebook Page + Instagram) and TikTok.
2. Upload a video once and publish it to every connected platform, with live status per platform.
3. See real analytics (views, likes, comments, shares, saves, watch time where available) per post, per platform and overall, pulled from each platform's API on a schedule.
Web (Filament + API) and mobile must show the same numbers because both read from the same backend services.
OUT OF SCOPE unless everything above passes QA: billing UI, iOS build, dynamic icon, swipe tabs, digest notifications.

WORKSPACE AND TOKEN RULES
- Backend: clippipeline.com (Laravel 12, Filament, PHP 8.3, branch main). Mobile: clippipeline-mobile (Expo SDK 57, Expo Router, branch feat/app-screens-auth-charts). Read HANDOFF.md first.
- Never open files outside these two repos and the graphify folder.
- Graphify is your map. Read its report/summary first (e.g. GRAPH_REPORT.md, graph.json) to locate code, then open only the files you need with grep and partial reads. Never read whole directories. If graphify disagrees with a file, trust the file.
- Subagent briefs must be short and self-contained: goal, exact files they own (from graphify), the relevant CONTRACT.md section, rules, done criteria. Don't paste the whole handoff.
- Subagents return at most 200 words: files changed, endpoints/commands added, tests run and result, blockers. No code dumps. Review their work with git diff --stat and targeted diffs, not by re-reading files.
- Use the cheapest capable model for search-only and lookup subagents if you can choose.

HARD RULES (from HANDOFF.md)
- Backend: never run composer update, migrate:fresh or db:seed, never touch the production DB. New migration files only.
- Mobile: npx expo install is blocked. Get the version from node_modules/expo/bundledNativeModules.json and npm install pkg@version. Don't commit package-lock.json. Check the Expo SDK 57 docs before using any Expo API.
- Never commit secrets. Add every new key to .env.example with an empty value. Keep the combined google-services.json.
- Reuse the OAuth callback URLs already registered on production (find them in config/services.php and routes). Do NOT introduce new redirect URIs. Mobile goes through the backend web callback, which then deep-links back to clippipelinemobile://.
- Platform APIs change. Check the current official docs (YouTube Data API v3, YouTube Analytics API, Meta Graph API, TikTok Login Kit / Content Posting API / Display API) before writing any call. Pin the Graph API version in config.
- Hosting is Hostinger shared: no supervisor, no root, assume no ffmpeg.

PHASE 0 (LEAD, before any subagent)
1. git status in both repos. Create branch feat/go-live in each from the current branch. Keep any uncommitted changes.
2. Read HANDOFF.md and the graphify reports. Confirm: User::canAccessPanel exists (fixes /admin 403), post_distributions has published_at/meta/error/external_id, queue and scheduler config.
3. Write docs/CONTRACT.md in the backend and copy it to clippipeline-mobile/docs/CONTRACT.md. Define every endpoint for connect, accounts, posts (upload/publish/status/retry), analytics (overview, per-platform, timeseries, per-post) with exact request/response JSON. Keep existing routes where they exist. This is the single source of truth; mobile TS types must match it exactly.
4. Pre-create the shared files so agents don't collide: route stubs in routes/api.php and routes/web.php, config/services.php keys, .env.example keys, scheduler entries. Agents may only edit shared files inside their own marked block (// --- agent:<name> ---).
5. Create the task list.

WAVE 1: spawn these 3 subagents in ONE message so they run in parallel (backend)

1A CONNECT agent
- OAuth connect for:
  youtube: Google, scopes youtube.upload, youtube.readonly, yt-analytics.readonly, access_type=offline, prompt=consent.
  meta: Facebook Login with pages_show_list, pages_read_engagement, pages_manage_posts, read_insights, business_management, instagram_basic, instagram_content_publish, instagram_manage_insights. Store each Page token and its instagram_business_account id.
  tiktok: Login Kit v2 with user.info.basic, video.list, video.publish, video.upload (PKCE if the docs require it).
- GET /api/connect/{provider}/start (auth) returns an auth URL with a signed state carrying user id and platform (web|mobile). The existing web callback stores tokens encrypted (encrypted casts), then redirects to Filament (web) or clippipelinemobile://connect?provider=..&status=ok|error (mobile). DELETE /api/social-accounts/{id}.
- Account status: active | needs_reauth | error, with expires_at. Token refresh service per provider. On refresh failure mark needs_reauth and send the existing push to the user.
- Command app:backfill-accounts for existing accounts missing ig_user_id or page ids.
- Every account lookup must be scoped to the post owner's user_id.

1B PUBLISH agent
- POST /api/posts: multipart video upload, title, caption, hashtags, platforms[], optional scheduled_at. Same flow as a Filament action. Store on the public disk with an absolute HTTPS URL, and verify with a HEAD request that it's publicly reachable (Instagram and Facebook fetch by URL).
- One PostDistribution and one job per platform: YouTube resumable upload, Instagram Reels (create container, poll until FINISHED, publish), Facebook Page Reels, TikTok Content Posting API direct post (if the app is unaudited use SELF_ONLY privacy and record that in meta).
- Jobs: idempotent (skip if external_id is set), ShouldBeUnique on distribution id, 3 tries with backoff, timeout lower than retry_after, real error message stored. Status flow: queued, uploading, processing, published or failed. POST /api/distributions/{id}/retry plus a Filament action.
- Thumbnails: after publish, save the platform's thumbnail URL into posts.thumbnail (YouTube thumbnails, IG thumbnail_url, TikTok cover). No ffmpeg.
- Queue on shared hosting: QUEUE_CONNECTION=database, and in the scheduler run queue:work --stop-when-empty --max-time=50 every minute with withoutOverlapping. Uploads only ever run inside jobs, never in the request.
- scheduled_at: dispatch at that time from the scheduler.
- TikTok ingest: check the docs. If the official API can't return a downloadable video file, make upload-once-publish-everywhere (TikTok included) the main flow. Keep the existing scraper ingest optional, skipped cleanly when not configured.

1C ANALYTICS agent
- One AnalyticsService used by BOTH the API and Filament. This is what keeps web and mobile in sync.
- Fetchers: YouTube (videos.list statistics + YouTube Analytics API for watch time and average view duration), Instagram (Reels media insights, using the current metric names from the docs), Facebook (video insights), TikTok (video/query view, like, comment, share counts). Follower count per connected account.
- Store daily snapshots in post_analytics. Migration for missing columns: platform, distribution_id, views, likes, comments, shares, saves, watch_time_seconds, captured_on, unique per distribution per day. Account follower snapshots in their own table.
- Command analytics:sync every 3 hours, plus one sync about 1 hour after each publish. Respect quotas and back off on rate limits.
- Endpoints per CONTRACT.md: overview (totals + change vs previous period, 7d/30d/90d), per-platform breakdown, timeseries, per-post per-platform. Logged-in users never get sample numbers; return empty data instead.

GATE 1 (LEAD): php artisan test, ./vendor/bin/pint --test, and php artisan route:list must match CONTRACT.md. Fix or send back to the agent. Commit per agent.

WAVE 2: spawn these 2 in ONE message (parallel)

2A MOBILE agent (clippipeline-mobile only)
- src/api/types.ts mirrors CONTRACT.md exactly; hooks in src/api/hooks.ts for every endpoint. Guest mode keeps demo data; logged-in uses real data only.
- Connect screen: status per platform (connected / needs re-auth / not connected). Connect with expo-web-browser auth session to /api/connect/{provider}/start?platform=mobile, handle the clippipelinemobile://connect deep link, refetch accounts. Disconnect.
- Create post flow: pick video (SDK-pinned picker), title, caption, hashtags, choose connected platforms, optional schedule, upload with progress, then open post details.
- Post details: per-platform status chips that poll every 5s while any distribution is queued/uploading/processing. Retry failed. Per-platform metrics. Open-on-platform link.
- Dashboard and Insights: real overview, platform breakdown and timeseries charts for 7d/30d/90d. Pull-to-refresh, refetch on focus, and published/failed push notifications invalidate the post queries.
- Keep the existing design system and tab bar. npx tsc --noEmit and npx expo lint must pass.

2B WEB agent (backend Filament only)
- Connected Accounts page: connect, reconnect, disconnect per provider with status and expiry.
- Posts resource: create with upload and platforms; distributions relation manager with status, error, link and retry.
- Dashboard widgets from AnalyticsService: totals, per-platform, timeseries chart, top posts. Same numbers as the API.

WAVE 3: QA agent (fresh context, did not write the code)
- Contract check: route:list vs CONTRACT.md vs mobile types.ts. Fix mismatches.
- Backend feature tests with Http::fake for: connect callback (tokens + IG id saved), each publish job (success, failure, idempotent retry), analytics parsing per platform, overview math, user scoping.
- Add php artisan app:smoke {email}: for each connected account, refresh the token, make one analytics call, print status per platform.
- Add php artisan app:test-crosspost {email} {path}: real post (YouTube private, TikTok SELF_ONLY), prints the result per platform verbatim.
- Mobile: tsc, lint, and confirm no screen shows demo data when logged in.

FINISH (LEAD)
- Logical commits on feat/go-live in both repos. Merge backend into main and mobile into feat/app-screens-auth-charts. Push both.
- Bump app.json android.versionCode and run: npx eas-cli build -p android --profile preview --non-interactive --no-wait. Report the build link.
- Update HANDOFF.md with what changed and what's left.
- Final report, short:
  1. What works now.
  2. Server commands in order, using /opt/alt/php83/usr/bin/php: git pull, composer install --no-dev, migrate --force, optimize:clear, check storage:link, app:backfill-accounts, app:smoke.
  3. The hPanel cron line.
  4. Env keys I must fill (only the missing ones) and PHP upload limits to raise in hPanel.
  5. Console checklist: APIs to enable in Google Cloud (YouTube Data API v3, YouTube Analytics API), Meta app permissions and the Instagram professional account linked to a Facebook Page, TikTok products (Login Kit, Content Posting API) and scopes.
  6. Platform limits code can't fix, each with what to apply for: YouTube audit (uploads stay private), TikTok audit (SELF_ONLY), Google consent screen in Testing (7-day tokens).