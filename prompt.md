ROLE
You are the LEAD ENGINEER for ClipPipeline. You plan, spawn subagents with the Agent/Task tool, merge, verify and push. Do NOT ask me questions. Decide, build, test, push. Anything that needs me (console settings, secrets, server commands, review forms) goes in the final report.

GOAL
1. Every button, link, tab, toggle, chip and list item on the 5 mobile pages (Home, Posts, Connect, Insights, Profile), including post details, does something real. Guest mode and logged-in mode both count.
2. The website (Filament panel at clippipeline.nonsostudio.com) has the same functionality as those 5 pages, with the same numbers, because both read from the same backend services.
3. The app meets the developer compliance rules of TikTok, Meta (Facebook + Instagram) and YouTube/Google, so I can submit for review.

UI FREEZE (most important rule)
- The mobile UI is finished and I love it. Do NOT change styles, colors, spacing, fonts, icons, layout, animations or the tab bar.
- Allowed: handlers, data wiring, loading/error/empty states using EXISTING components, and new sheets/screens only where a button currently has nowhere to go. Build those from existing components so they look native to the app.
- Web: use standard Filament components. No redesign.

DEFINITION OF "FUNCTIONAL"
Every pressable element must do one of these:
(a) navigate somewhere real,
(b) call the API with loading, success and error feedback,
(c) in guest mode, open a "Sign in to do this" sheet (built from existing components) for actions that need an account.
Dead patterns to hunt for: onPress={() => {}}, missing onPress, TODO/FIXME in handlers, console.log-only handlers, "coming soon" alerts, href="#", Filament actions without an action. Logged-in users must never see demo data. Guest mode keeps its demo data.

TOKEN RULES
- Read HANDOFF.md, then the graphify report/graph to locate code. Open only the files you need, with grep and partial reads. Never read whole directories. If graphify disagrees with a file, trust the file.
- Subagent briefs are short and self-contained. Subagents return at most 200 words: findings or files changed, tests run, blockers. Full detail goes in the files they write, not in the reply.
- Review agent work with git diff --stat and targeted diffs.

HARD RULES (from HANDOFF.md)
- Backend: never run composer update, migrate:fresh or db:seed, never touch the production DB. New migration files only.
- Mobile: npx expo install is blocked; use the version in node_modules/expo/bundledNativeModules.json with npm install pkg@version. Don't commit package-lock.json. Check the Expo SDK 57 docs before using any Expo API.
- Never commit secrets; add new keys to .env.example empty. Keep the combined google-services.json.
- Keep everything on clippipeline.nonsostudio.com. No new subdomains, no new OAuth redirect URIs.

PHASE 0 (LEAD)
1. git status in both repos. Create branch feat/parity in each from the current branch, keeping uncommitted changes.
2. From graphify, map the 5 mobile pages + post details to their files, and to their web (Filament) equivalents if any exist.
3. Create docs/audit/, docs/compliance/, and the task list.

WAVE 1: spawn these 8 agents in ONE message (parallel). All are READ-ONLY on code.

RESEARCH AGENTS R1 TikTok, R2 Meta, R3 YouTube/Google
Shared brief:
- Use WebSearch/WebFetch. Official sources only (developers.tiktok.com, developers.facebook.com, developers.google.com, support.google.com, youtube.com/t, play.google.com policy pages). Every requirement gets its source URL. Mark anything you couldn't confirm on an official page as UNVERIFIED. Don't read the codebase.
- ClipPipeline's features: OAuth connect; upload a video once and publish it to every connected platform; per-post and per-account analytics (views, likes, comments, shares, saves, watch time, followers); web + Android app.
- Write docs/compliance/<platform>.md with these sections:
  1. Scopes/permissions our features need, the minimum set, plus ready-to-paste justification text for each.
  2. MUST-have UI elements in the app (exact wording where required).
  3. Required policy-page content (privacy policy, terms), including required links and disclosures.
  4. Data deletion, revocation and retention rules, and anything they require us to build (callbacks, URLs, refresh/delete timelines for stored data).
  5. Review/audit process step by step, plus a demo-video shot list.
  6. Limits that affect our design: rate limits, quotas, video specs (duration, size, aspect ratio), posts per day.
  7. Branding rules.
  8. Split: CODE checklist (for the build agents) vs CONSOLE checklist (things Nonso does himself).
- R1 TikTok: content sharing guidelines, creator_info rules, Direct Post vs Upload, the audit and what unaudited apps can do, Login Kit, Display API / video.list for analytics, scopes.
- R2 Meta: App Review per permission (screencast rules), Standard vs Advanced Access, Business Verification, data deletion callback vs instructions URL, deauthorize callback, Facebook Login vs Instagram Login for Instagram publishing, Instagram content publishing limits and Reels specs, Facebook Page Reels publishing, insights permissions, dev-mode tester roles, Platform Terms.
- R3 YouTube/Google: OAuth verification for our scopes (are they sensitive or restricted, what verification needs), Google API Services User Data Policy incl. Limited Use disclosure, YouTube API Services Terms and Developer Policies (required links to YouTube Terms and Google Privacy Policy, revoke-access instructions, rules on storing and refreshing API data — check whether stored analytics must be refreshed or deleted within a time limit and what that means for our daily snapshots), the compliance audit and quota extension, private-upload rule for unaudited projects, Shorts specs, branding. Also Google Play policy: in-app account deletion plus a web deletion link for apps with account creation.

PAGE AUDITORS P1 Home, P2 Posts (+ post details), P3 Connect, P4 Insights, P5 Profile
Shared brief:
- Audit what ACTUALLY exists on the page (the examples below are hints, not a spec). List every interactive element on mobile in guest AND logged-in mode, and its web equivalent.
- For each element record: what it should do, what it does now (file:line), status (works / broken / dead / demo-data-when-logged-in / missing-on-web), and the fix needed (endpoint, handler, or screen).
- Also check: loading, error and empty states exist; logged-in data comes from the real API; web and mobile call the same endpoint/service for the same numbers.
- Write docs/audit/<page>.md as a table. Do NOT edit code.
- Hints: Home: KPI cards, period switch, recent posts, quick actions, notification bell. Posts: filter tabs, list items, create post, post details (status per platform, retry, open on platform, delete). Connect: connect/reconnect/disconnect per platform, status, return from OAuth. Insights: period and platform filters, charts, top posts. Profile: edit profile, plan, notification settings, privacy/terms/support links, sign out, delete account.

LEAD MERGE (after Wave 1)
- Combine the 5 audits into docs/PARITY.md: one table of every element with mobile status, web status and the owner agent for each fix.
- Combine the CODE checklists from docs/compliance/*.md into docs/COMPLIANCE.md, and the CONSOLE checklists into docs/compliance/NONSO_CHECKLIST.md.
- Update docs/CONTRACT.md (create it if missing) with every endpoint the fixes need, with exact request/response JSON. Copy it to clippipeline-mobile/docs/CONTRACT.md. Mobile TS types must match it exactly.
- Pre-create shared stubs (routes, config, .env.example keys). Agents edit shared files only inside their own marked block (// --- agent:<name> ---).

WAVE 2: spawn these 3 in ONE message (parallel, contract-first)

BACKEND agent (clippipeline.com, API + services only)
- Every endpoint in CONTRACT.md the PARITY fixes need, scoped to the logged-in user.
- Compliance backend from docs/COMPLIANCE.md, including: TikTok creator_info endpoint, account deletion (API + public web page/URL), Meta data deletion callback, revoke/disconnect that also revokes the platform token where the platform supports it, stored-data retention/refresh rules from the YouTube research, public /privacy and /terms pages.
- Feature tests with Http::fake for every new endpoint.

MOBILE agent (clippipeline-mobile only, UI FREEZE applies)
- Fix every mobile row in docs/PARITY.md. Wire hooks to CONTRACT.md. Guest-mode actions open the sign-in sheet.
- Profile: working delete account (with confirmation), privacy/terms links, sign out that clears tokens and the react-query cache.
- Compliance UI items from docs/COMPLIANCE.md for mobile.
- npx tsc --noEmit and npx expo lint must pass.

WEB agent (clippipeline.com Filament only)
- Give users the same 5 sections in the panel navigation, in the same order: Home (dashboard widgets), Posts (create, list, details with per-platform status, retry, delete), Connect (connect/reconnect/disconnect with status), Insights (same filters and charts, same service as the API), Profile (edit, notifications, delete account, sign out, policy links). Admin-only resources stay admin-only.
- Fix every web row in docs/PARITY.md, plus the web compliance UI items from docs/COMPLIANCE.md.

TIKTOK COMPLIANCE (applies to BACKEND, MOBILE and WEB agents)
- Follow https://developers.tiktok.com/doc/content-sharing-guidelines exactly for the TikTok post form on web and mobile.
- Before showing the form, call creator_info and display the creator's name/avatar. Populate the privacy dropdown ONLY from the returned options, with NO default selected. Allow comments/Duet/Stitch toggles start off and are disabled when the creator has them disabled. Block videos longer than the returned max duration. Include the content disclosure and music usage notices the guidelines require.
- Add a confirm step showing caption, privacy level and interaction settings before publishing. No one-click TikTok posting.
- Use FILE_UPLOAD (chunked) for TikTok, not PULL_FROM_URL, so no domain verification is needed.
- Add public pages /privacy and /terms on clippipeline.nonsostudio.com describing what ClipPipeline stores (videos, tokens, analytics), why, and how users delete their data. Link them on the login screen and footer (web and mobile).
- While TIKTOK_AUDITED=false in .env, show "TikTok posts stay private until ClipPipeline passes TikTok's review" on the TikTok form.
- Keep everything on clippipeline.nonsostudio.com. Do not introduce new subdomains or redirect URIs.
The privacy and terms pages must ALSO include every policy-page requirement from the Meta and YouTube research (e.g. Limited Use disclosure, links to YouTube Terms and Google Privacy Policy, revoke-access instructions, data deletion instructions).

GATE 2 (LEAD): php artisan test, ./vendor/bin/pint --test, npx tsc --noEmit, npx expo lint. php artisan route:list must match CONTRACT.md. Fix or send back to the agent.

WAVE 3: QA agent (fresh context, did not write the code)
- Re-walk docs/PARITY.md row by row. Every row must be "works" on mobile and web, or have a written reason.
- Grep both repos for the dead patterns listed above; zero allowed in the 5 pages and post details.
- If Playwright is available: run the mobile app with npx expo start --web and click every element on the 5 pages in guest mode. Use a local test database (never production) to click through the web panel. Otherwise produce a manual click-test checklist.
- Check every MUST item in docs/COMPLIANCE.md is implemented, with file:line.
- Visual check: git diff on mobile style/layout code must show no changes outside new sheets/screens. Revert any accidental UI change.

FINISH (LEAD)
- Logical commits on feat/parity in both repos. Merge into the main working branch of each repo and push.
- Bump app.json android.versionCode and run: npx eas-cli build -p android --profile preview --non-interactive --no-wait. Report the build link.
- Update HANDOFF.md.
- Final report, short:
  1. Parity result: elements fixed per page, anything left and why.
  2. Server commands in order using /opt/alt/php83/usr/bin/php (git pull, composer install --no-dev, migrate --force, optimize:clear).
  3. Env keys I must fill (missing ones only).
  4. NONSO_CHECKLIST.md summary per platform: what to set in the TikTok, Meta and Google consoles, the URLs to enter (privacy, terms, data deletion, account deletion), and the justification text to paste.
  5. The demo-video shot list for each platform's review.

  can i now use google to lohin like google authenticqation on the mobile caue i know the website own works?