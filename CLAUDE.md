# Ad Libitum Vita — Claude Code Autonomous Build / Deploy Handoff

**Date:** 2026-08-21  
**Repository:** `Thesis-Web/adlibitumvita`  
**Development checkout:** `/home/deploy/repos/adlibitumvita`  
**Server:** DigitalOcean droplet `thesisweb-prod-2026` (`146.190.139.104`)  
**Execution mode:** autonomous / dangerous mode, but strictly bounded to the ALV application and explicitly allowed machine-level integration points below.

---

# 0. EXECUTION DIRECTIVE

You are the implementation agent. Do not spend the session explaining what you intend to do. Inspect, decide, implement, test, commit, push, deploy, verify, and leave a concise final report.

You are authorized to make reasonable implementation decisions inside this specification without asking the human for approval.

You MUST NOT stop because:

- the Facebook export is not ready;
- production content is not present yet;
- R2 credentials are not present yet;
- DNS is not correctly pointed yet;
- the first real admin email/password has not been supplied yet.

In each of those cases, implement the complete interface/fallback, test it with ephemeral/test data where appropriate, continue the build, and report the single remaining external action at the end.

The intended outcome of this run is a deployed, functioning **Phase 1 Ad Libitum Vita application** with:

1. fast public site;
2. login/authentication;
3. member-gated library;
4. Captain's Log collection;
5. Beyond the Map collection;
6. admin dashboard for easy single-entry publishing;
7. multi-image asset upload;
8. user/family access management;
9. searchable SQLite content store;
10. bulk-import interfaces ready for the later Facebook export and Markdown directories;
11. GitHub-driven atomic deployment;
12. clean separation from every other application on this droplet.

Do not build payment integration today. Preserve a clean entitlement seam for it.

---

# 1. CURRENT MACHINE / REPOSITORY STATE

Re-check these facts before modifying anything, but they were observed immediately before this handoff:

```text
hostname: thesisweb-prod-2026
Ubuntu:   24.04.4 LTS
CPU:      1 vCPU
RAM:      1.9 GiB
Swap:     0
Disk:     ~48 GiB filesystem, ~31 GiB free
Node:     v20.20.1
npm:      10.8.2
pnpm:     9.15.4
yarn:     1.22.22
Python:   3.12.3
nginx:    1.24.0, ACTIVE
Docker:   installed, but NOT part of ALV v1 architecture
Postgres: inactive / not required for ALV v1
```

Known listening services include:

```text
80/443     nginx
127.0.0.1:3001 existing unrelated Node service
```

The ALV repository is currently empty except for `.git`:

```text
/home/deploy/repos/adlibitumvita
origin git@github.com-thesisweb:Thesis-Web/adlibitumvita.git
branch main
```

The GitHub SSH alias for the Thesis-Web identity is:

```text
Host: github.com-thesisweb
Remote form:
git@github.com-thesisweb:Thesis-Web/<repo>.git
```

Do not change the SSH identity convention.

Before implementation run a concise inventory:

```bash
pwd
git status
git remote -v
git branch --show-current
ss -lntp
systemctl --no-pager --type=service --state=running
nginx -T >/tmp/alv-nginx-inventory.txt 2>&1 || true
gh auth status || true
```

Do not dump secrets into logs or commits.

---

# 2. HARD ISOLATION BOUNDARY

Ad Libitum Vita is an independent product that merely shares a machine.

## Shared machine infrastructure allowed

ALV may share only:

- Ubuntu host;
- nginx as the machine ingress/reverse proxy;
- systemd;
- Node runtime;
- the machine's SSH/Git tooling.

## ALV-owned resources

Everything else must belong solely to ALV:

- application code;
- Node process/service;
- SQLite database;
- auth data;
- users;
- sessions;
- access grants;
- content;
- content revisions;
- media metadata;
- local fallback media;
- R2 configuration;
- backups;
- deploy directories;
- deploy workflow;
- health endpoints.

## DO NOT couple to or modify

Do not import code, call APIs, share databases, share runtime state, or modify application files belonging to:

- Thesis Project;
- thesisweb-backend;
- ExNulla;
- Nexus;
- CERS;
- Orbital;
- Huson Outdoors;
- Stay Baited;
- any other sibling application.

These projects may be inspected READ-ONLY for implementation patterns.

The future migration criterion is:

> ALV should be movable to its own droplet by moving its release/config/data/media state, adjusting nginx/DNS, and starting its own service. No surgery on a shared backend should be required.

---

# 3. REFERENCE IMPLEMENTATIONS — READ ONLY

The strongest reference is the local ExNulla site:

```text
/home/deploy/repos/exnulla-site
```

If needed, remote:

```text
git@github.com-thesisweb:Thesis-Web/exnulla-site.git
```

Inspect, do not modify:

```text
.github/workflows/deploy.yml
scripts/deploy-to-droplet.sh
site/
docs/demo-intergration-blueprint-exnulla-site-1-0-0.md
```

Important ExNulla principles to reuse:

- static-first;
- fast shell;
- GitHub Actions build off-box;
- SHA-addressed immutable releases;
- rsync release artifact;
- invariant check before cutover;
- atomic `current` symlink flip;
- nginx validation;
- deterministic rollback;
- heavy/interactive functionality isolated from the shell;
- provenance/version stamp.

Also inspect READ-ONLY when useful:

```text
/home/deploy/repos/thesis-web-com-site
/home/deploy/repos/husonoutdoors-site
```

Do NOT visually clone ExNulla. Reuse engineering discipline, not branding.

---

# 4. LOCKED V1 ARCHITECTURE

Use this unless a current package incompatibility makes a narrow change necessary.

## Application

- **Astro 5, static-first**
- strict TypeScript
- official Node adapter for on-demand routes
- public pages pre-rendered/static where practical
- authenticated/admin/API routes rendered on demand
- minimal client JavaScript
- mobile-first
- no heavyweight SPA unless a specific admin widget genuinely needs an island

Use the installed/current compatible Astro version, not an arbitrarily old pin.

The public shell must remain "boring fast."

## Runtime

One ALV Node service behind nginx.

No Docker for v1.

No PostgreSQL for v1.

No separate general-purpose ALV backend service unless Astro's Node adapter cannot cleanly satisfy the requirements. Prefer one application process.

## Authentication

Use **Better Auth** with:

- email/password;
- SQLite (`better-sqlite3`);
- public signup disabled;
- secure sessions;
- admin capability/plugin if current stable package supports it cleanly;
- roles at least `admin` and `user`.

Mount Better Auth through the canonical Astro API handler pattern.

Do not invent home-grown password hashing/session crypto when Better Auth can own it.

## Data store

SQLite at production path:

```text
/srv/adlibitumvita/shared/data/adlibitumvita.sqlite3
```

Development/test DBs must live in ignored local paths, for example:

```text
.data/dev.sqlite3
.data/test.sqlite3
```

Use WAL mode where appropriate.

Use SQLite FTS5 for member-library search.

## Persistent ALV paths

Preferred:

```text
/var/www/adlibitumvita/
├── releases/
│   └── <GIT_SHA>/
└── current -> releases/<GIT_SHA>

/srv/adlibitumvita/
└── shared/
    ├── .env
    ├── data/
    │   └── adlibitumvita.sqlite3
    ├── media/
    ├── backups/
    └── import/
```

The repo checkout remains:

```text
/home/deploy/repos/adlibitumvita
```

The repo checkout is development state, NOT production serving state.

Production must never be `git pull` + serve-the-checkout.

---

# 5. REPOSITORY VISIBILITY / CONTENT SECURITY

The application/code repository is intended to be:

```text
PUBLIC: Thesis-Web/adlibitumvita
```

Check:

```bash
gh repo view Thesis-Web/adlibitumvita --json visibility || true
```

If authenticated `gh` has sufficient permission and repo is still private, the human has explicitly authorized making this currently-empty/code-only repository PUBLIC. You may do so with the proper GitHub CLI visibility confirmation flag.

If permission is unavailable, continue building and report the exact one-line user action at the end.

### NON-NEGOTIABLE

Because the code repo is public:

**Never commit gated Captain's Log prose, Beyond the Map prose, production SQLite data, user data, secrets, uploaded media, Facebook exports, or auth credentials.**

The public Git repository contains:

- source code;
- migrations/schema;
- tests;
- public marketing copy;
- public teasers/placeholders;
- deploy scripts;
- docs;
- `.env.example`.

The actual gated content lives in SQLite.

---

# 6. PRODUCT MODEL

Brand:

```text
Ad Libitum Vita
"live life unscripted"
```

This is a family expedition/storytelling project, not a generic SaaS dashboard.

The two primary editorial collections are:

1. **Captain's Log**
   - expedition narrative;
   - entries conceptually behave like chapters;
   - numbered days may exist but the model must tolerate uncertain/nonlinear day labels;
   - photos/media are important.

2. **Beyond the Map**
   - "the mindset behind an expedition";
   - longer-form durable guide/book material;
   - entries/records may represent chapters or sections.

Do not manufacture fake expedition facts to fill the homepage.

Use tasteful, restrained placeholder/brand copy where content is genuinely missing.

Visual direction:

- editorial/travel/expedition;
- photography-forward;
- strong long-form reading experience;
- excellent mobile layout;
- readable typography;
- not a generic Tailwind SaaS card wall;
- not an ExNulla clone;
- system/local font stack preferred;
- low JS;
- excellent Core Web Vitals mindset.

---

# 7. ROUTES / INFORMATION ARCHITECTURE

Minimum routes:

## Public

```text
/
/login
/robots.txt
/sitemap.xml
/api/health
```

The homepage should contain enough real crawlable HTML to establish the brand and future search presence.

Recommended homepage sections, without overbuilding separate routes:

- hero: Ad Libitum Vita / live life unscripted;
- brief "the journey" framing;
- Captain's Log teaser;
- Beyond the Map teaser;
- about framing;
- member/login CTA.

A future `/journey`, `/about`, `/support`, maps, store, etc. may be added later. Do not waste today's time building them unless trivially derived.

## Authenticated member library

```text
/library
/library/captains-log
/library/captains-log/[slug]
/library/beyond-the-map
/library/beyond-the-map/[slug]
/library/search
/account
/logout
```

Unauthenticated access to member pages must redirect to `/login` (or 401 for API).

## Admin

```text
/admin
/admin/content
/admin/content/new
/admin/content/[id]
/admin/users
```

Use server-side authorization. Hiding a link is not authorization.

---

# 8. CRITICAL CONTENT-GATING RULE

The public client must NEVER receive gated full prose and merely hide it with JavaScript/CSS.

For a member-only entry:

- no full body in static HTML;
- no full body in page source;
- no full body in public JSON;
- no full body in sitemap;
- no full body in pre-generated search index;
- no full body in public repository;
- no full body in unauthenticated API responses.

Authorization occurs before querying/rendering protected body content.

The public homepage may expose:

- title;
- collection;
- safe excerpt/teaser;
- optional public cover image;
- publication date;
- public metadata.

That is all.

Protected routes should emit `noindex` headers/meta as appropriate.

---

# 9. DATABASE / CONTENT SCHEMA

Use a simple migration system checked into Git. Raw SQL migrations are acceptable and preferred over introducing a large ORM solely for schema management.

Better Auth owns its required auth tables.

Application tables should include at least the equivalent of:

## `content_entries`

```text
id                  TEXT PK (UUID)
collection          TEXT NOT NULL
                    ('captains-log' | 'beyond-the-map')
slug                TEXT UNIQUE NOT NULL
title               TEXT NOT NULL
subtitle            TEXT
excerpt             TEXT
body_markdown       TEXT NOT NULL
status              TEXT NOT NULL
                    ('draft' | 'published')
visibility          TEXT NOT NULL
                    ('members' | 'public')
day_number          INTEGER NULL
chapter_number      INTEGER NULL
section_number      TEXT NULL
expedition_date     TEXT NULL
location            TEXT NULL
tags_json           TEXT NOT NULL DEFAULT '[]'
sort_order          REAL NULL
published_at        TEXT NULL
created_at          TEXT NOT NULL
updated_at          TEXT NOT NULL
created_by          TEXT NULL
updated_by          TEXT NULL
source_type         TEXT NULL
source_ref          TEXT NULL
source_hash         TEXT NULL
```

Do not force every Captain's Log into a perfect integer day. The expedition already has "whatever day this is" style entries.

## `content_revisions`

Every meaningful admin save/publish should preserve a revision sufficient to roll back content.

Equivalent fields:

```text
id
content_id
revision_number
snapshot_json OR snapshot columns
created_at
created_by
```

Admin UI should provide at minimum a simple revision/history list and restore action if feasible in the timebox. If restore UI is too much, implement the data and a CLI restore command.

## `media_assets`

```text
id
content_id
storage_provider       ('local' | 'r2')
storage_key
mime_type
width
height
byte_size
alt_text
caption
sort_order
is_cover
visibility             ('members' | 'public')
created_at
created_by
```

Do not persist expiring signed URLs as canonical identifiers.

Persist provider + key.

## `access_grants`

Provider-neutral entitlement seam:

```text
id
user_id
scope                   e.g. 'library'
source                  ('manual' | future 'stripe' | 'patreon' | ...)
source_ref
status                  ('active' | 'inactive' | 'expired')
starts_at
ends_at
created_at
updated_at
```

V1 family users receive:

```text
source = manual
scope  = library
status = active
```

Library authorization:

```text
admin
OR
authenticated user with active library grant
```

Do not implement Stripe/PayPal/Patreon today.

## `import_jobs`

Lightweight tracking is useful:

```text
id
type
source_path
status
summary_json
created_at
completed_at
```

## FTS5

Create a protected search index over at least:

- title;
- excerpt;
- body;
- location;
- tags.

Keep it synchronized transactionally on content changes.

Search is for authenticated library users.

---

# 10. ADMIN AUTHORING EXPERIENCE — HIGH PRIORITY

This is not an afterthought. The human needs to update the site frequently and cheaply.

Build a clean admin dashboard optimized for quick entry from laptop and usable from a phone.

## Content list

Show:

- collection;
- title;
- day/chapter/section label;
- draft/published;
- member/public;
- updated date;
- edit action;
- preview/view action.

Filters:

- collection;
- status.

## New/edit form

Required fields/controls:

- Collection:
  - Captain's Log
  - Beyond the Map
- Title
- Slug (auto-generate, editable)
- Subtitle optional
- Excerpt
- Body Markdown — large comfortable editor
- Day number optional
- Chapter number optional
- Section number/string optional
- Expedition date optional
- Location optional
- Tags
- Visibility: members/public
- Status: draft/published
- Sort order optional
- Save Draft
- Publish / Update

Nice-to-have if quick:

- live Markdown preview;
- keyboard shortcut save;
- autosave draft;
- word count.

Do not burn hours implementing a rich-text editor. Markdown textarea is canonical and portable.

All rendered Markdown MUST be sanitized against script/XSS injection.

## Media manager in entry editor

Required:

- multi-file picker;
- drag/drop if inexpensive;
- upload progress/basic feedback;
- show thumbnails;
- reorder assets;
- set cover;
- edit alt text;
- edit caption;
- remove asset.

Production web media are derivatives; original camera files remain in Google Photos and are not required to be retained here.

Reasonable default transform:

- orientation-correct;
- maximum long edge around 1600–2000 px;
- WebP or AVIF/WebP where browser/tooling support is dependable;
- sensible quality;
- thumbnail derivative around 400–600 px.

`sharp` is acceptable if it integrates cleanly.

Do not keep temporary originals after derivative generation unless explicitly configured.

Set upload size/type limits and reject obviously invalid files.

---

# 11. MEDIA STORAGE ABSTRACTION

R2 is the intended production media target, but R2 credentials may not exist during this run.

Implement a provider interface from day one.

For example conceptually:

```ts
interface MediaStorage {
  put(...): Promise<...>;
  delete(...): Promise<void>;
  getMemberUrlOrStream(...): Promise<...>;
  getPublicUrl(...): Promise<...>;
}
```

No `any`. Strict types.

## Provider A — local fallback, must work today

Persistent path:

```text
/srv/adlibitumvita/shared/media/
```

Member-only local media must be delivered through an authenticated route or equivalent access check.

Do not simply expose the entire members media directory via an unauthenticated nginx alias.

Public marketing assets may remain normal static repo assets.

## Provider B — Cloudflare R2, ready via environment

Use R2's S3-compatible API through the modern AWS SDK v3 or another compact dependable S3 client.

Environment contract, names may vary but must be clear:

```text
MEDIA_DRIVER=local|r2

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=        # only if using public assets/custom domain
```

Prefer a private bucket for member-only media.

For member media, generate short-lived access or proxy/stream after auth. Do not make the entire paid/family archive permanently public just because object storage exists.

If credentials are absent:

- app runs with local provider;
- admin upload works;
- tests pass;
- `.env.example` documents R2;
- README gives exact R2 enable steps;
- no build blocker.

Do NOT hotlink Google Photos as the production media CDN.

Google Photos is the archival/original master.

---

# 12. AUTH / USER MANAGEMENT

## Rules

- email/password enabled;
- public self-registration disabled;
- no shared family password;
- each family member gets an individual account;
- secure cookie configuration for production;
- trust nginx proxy headers correctly;
- no secrets in code.

Use Better Auth's current stable Astro integration and SQLite support.

Use Better Auth admin facilities if stable/current enough for:

- list users;
- create user;
- set/reset password;
- roles.

If the admin plugin introduces an incompatible beta-only requirement, use the stable core plus a minimal app-owned role layer rather than adopting unstable package versions blindly.

## First admin bootstrap

The human has NOT provided the production admin email/password in this prompt.

Therefore:

- implement a safe bootstrap CLI;
- do not invent a real credential;
- do not leave a default admin/default password;
- do not block deployment.

Preferred operator experience:

```bash
cd /var/www/adlibitumvita/current
npm run admin:create -- --email user@example.com --name "Name"
```

Password should be prompted securely OR passed through a transient environment variable not written to shell history if practical.

The command must:

1. create/auth user;
2. assign admin role;
3. create active manual library grant;
4. refuse duplicate admin unless explicit update/force semantics exist.

Document exact command in final report.

After first admin login, `/admin/users` should allow creation of ordinary family users with an active manual library grant.

---

# 13. IMPORT PIPELINE — BUILD NOW, DATA ARRIVES LATER

The Facebook export is currently still processing.

Build the interfaces now.

## A. Canonical Markdown-directory importer

Support a structure like:

```text
Captains_Log/
├── day-01/
│   ├── captains-log.md
│   └── assets/
│       ├── ...
├── day-02/
...
```

Command shape:

```bash
npm run import:markdown -- --source /path/to/Captains_Log --dry-run
npm run import:markdown -- --source /path/to/Captains_Log --commit
```

Requirements:

- dry run by default or explicit dry-run;
- deterministic slugging;
- safe upsert strategy;
- content hash/source tracking;
- media goes through the same MediaStorage abstraction;
- a failed entry must not corrupt prior entries;
- concise import report.

Do not assume all folders 01–70 are populated.

## B. Facebook export importer

The actual schema cannot be finalized until the current export arrives.

Implement:

```bash
npm run import:facebook -- --source /path/to/export --discover
```

Discovery mode should:

- recursively inventory JSON/HTML/media files;
- identify likely post JSON;
- print representative candidate paths/schema keys;
- identify media directories;
- write no DB changes.

Then structure code so a parser can be added quickly after the real export is inspected.

If you can robustly support common Meta JSON post formats without guessing destructively, do so behind dry-run and explicit commit flags.

Do NOT write a brittle importer that silently maps random Facebook posts into Captain's Log.

## Private staging path

Raw export will eventually live outside Git:

```text
/home/deploy/uploads/adlibitumvita/facebook-export/
```

or:

```text
/srv/adlibitumvita/shared/import/
```

Add instructions and `.gitignore`; never commit raw export.

---

# 14. SEARCH

Authenticated library users need search.

Implement SQLite FTS5.

Search UI can be simple:

```text
/library/search?q=...
```

Search across both collections.

Return:

- title;
- collection;
- safe result snippet;
- metadata;
- link.

Search endpoint/results require library authorization.

Do not generate a static/public full-text index containing gated bodies.

---

# 15. PUBLIC SEO / PERFORMANCE

Public site must be genuinely crawlable.

Implement:

- semantic server-rendered HTML;
- title/description;
- canonical URL;
- Open Graph basics;
- `robots.txt`;
- `sitemap.xml` containing public URLs only;
- accessible headings;
- alt text for public images;
- no gated pages in sitemap;
- no protected body leakage.

Performance:

- static/prerender public routes;
- minimal JavaScript;
- hashed assets;
- lazy-load noncritical images;
- avoid giant frameworks/components;
- no Google Font dependency unless there is a compelling reason;
- no autoplay video;
- responsive image dimensions to avoid CLS.

The public page must remain useful with JavaScript disabled.

---

# 16. VERSION / PROVENANCE

Reuse the ExNulla philosophy.

Expose build provenance:

```text
/meta/version.json
```

At minimum:

```json
{
  "git_sha": "...",
  "built_at": "...",
  "app": "adlibitumvita"
}
```

`/api/health` should return a compact healthy response including Git SHA and a lightweight database check, without leaking secrets.

---

# 17. DEPLOYMENT — GITHUB ATOMIC RELEASES

This is a hard requirement.

Model the proven ExNulla deploy pipeline.

## Build location

Production build should occur on GitHub Actions, not the 1-vCPU droplet, whenever possible.

Use current stable official actions.

On push to `main`:

1. checkout;
2. set matching Node version;
3. `npm ci`;
4. format/lint/typecheck/tests;
5. run DB migration/schema validation against temporary DB;
6. build;
7. assert artifact invariants;
8. prepare production runtime artifact;
9. SSH to droplet;
10. rsync into `/var/www/adlibitumvita/releases/${GITHUB_SHA}`;
11. verify remote artifact;
12. take pre-deploy SQLite backup when production DB exists;
13. run idempotent migrations;
14. atomically flip `/var/www/adlibitumvita/current`;
15. restart `adlibitumvita.service`;
16. health check;
17. if health fails:
   - flip symlink back to previous release;
   - restart;
   - fail workflow;
18. on success keep only a small bounded release history, e.g. 5 releases.

Do not delete the current/previous good release.

## Runtime dependencies

Do not make production run `npm install` every deploy if it can be avoided.

Because GitHub's Linux runner and this droplet are both x86_64 Linux, it is acceptable to assemble a deployable runtime artifact on the runner containing the needed production dependencies, including `better-sqlite3`, provided CI tests the artifact.

Match Node major/version closely enough to avoid native module ABI surprises.

If that approach proves unreliable, use a small deterministic runtime-dependency install step on the droplet, but document why.

## Systemd

Create a dedicated service:

```text
adlibitumvita.service
```

Properties:

- runs as `deploy` unless a more restricted ALV user is trivially safe to establish;
- working directory points through `/var/www/adlibitumvita/current`;
- environment from `/srv/adlibitumvita/shared/.env`;
- binds only to loopback;
- unique free port;
- restart on failure;
- reasonable memory behavior;
- journald logs.

Do not reuse `thesisweb-backend.service`.

## Port

Inspect all ports.

Choose a free stable loopback port, preferably in a documented ALV-specific range.

Never bind ALV Node directly to the public Internet.

---

# 18. GITHUB ACTIONS DEPLOY SSH

The new repo may not yet possess deployment secrets.

Existing ExNulla uses repo secrets equivalent to:

```text
DEPLOY_SSH_KEY
DEPLOY_HOST
DEPLOY_USER
```

You cannot read another repository's GitHub secrets.

If `gh` is authenticated with sufficient permission, you are authorized to create a NEW repository-scoped deployment SSH key specifically for ALV Actions:

1. generate an ED25519 key dedicated to ALV Actions;
2. add the public key to `deploy` user's `authorized_keys`;
3. restrict/comment it sensibly;
4. set new repo Actions secrets with `gh secret set`;
5. never commit private key;
6. securely delete temporary plaintext private-key file after secret upload.

Set:

```text
DEPLOY_HOST=146.190.139.104
DEPLOY_USER=deploy
```

If GitHub CLI permission is insufficient:

- create the workflow;
- complete a direct bootstrap deployment safely from the droplet if needed;
- output exact secret names/commands required;
- do not stop implementation.

---

# 19. NGINX / TLS / DNS

## Existing edge

nginx already owns 80/443 and several unrelated sites.

Create only ALV's own config:

```text
/etc/nginx/sites-available/adlibitumvita.com
/etc/nginx/sites-enabled/adlibitumvita.com -> ../sites-available/adlibitumvita.com
```

Do not alter unrelated virtual hosts except where a machine-wide include already intentionally centralizes settings and a change is provably necessary.

Before reload:

```bash
sudo nginx -t
```

Always.

Proxy:

```text
adlibitumvita.com
www.adlibitumvita.com
        ->
127.0.0.1:<ALV_PORT>
```

Set normal forwarded headers correctly.

Use the existing machine's TLS/cert management convention after inspecting current nginx/Let's Encrypt setup.

Do not invent a second reverse proxy.

## Known Cloudflare screenshot state

The Cloudflare dashboard for `adlibitumvita.com` showed only three DNS records:

```text
NS adlibitumvita.com -> ns1.digitalocean.com
NS adlibitumvita.com -> ns2.digitalocean.com
NS adlibitumvita.com -> ns3.digitalocean.com
```

No visible apex A / www CNAME was present.

This screenshot alone does NOT prove which provider is currently authoritative at the registrar.

Determine actual live authority:

```bash
dig +short NS adlibitumvita.com
dig +short A adlibitumvita.com
dig +short A www.adlibitumvita.com
```

If public DNS is not pointed to this droplet, DO NOT stop.

Complete application/nginx/origin deployment and verify using loopback Host-header requests, for example:

```bash
curl -I -H 'Host: adlibitumvita.com' http://127.0.0.1/
```

If TLS exists, use appropriate `curl --resolve` validation.

At final report, provide the exact DNS records the human must add/change.

Expected desired web records, once Cloudflare is authoritative, are approximately:

```text
A      @      146.190.139.104
CNAME  www    adlibitumvita.com
```

Proxy status can be Cloudflare-proxied once origin/TLS policy is sane.

Do not delete NS records or change registrar delegation blindly. First determine live authority.

---

# 20. SECURITY MINIMUMS

This is family/private content now and intended paid content later.

Required:

- Better Auth handles credential/session security;
- no public signup;
- strong session secret via environment;
- Secure cookies in production;
- HttpOnly;
- sensible SameSite;
- server-side authorization;
- CSRF protections consistent with auth framework;
- body size/upload limits;
- MIME validation;
- generated storage keys, not user-provided filesystem paths;
- prevent path traversal;
- sanitize Markdown HTML;
- parameterized SQLite queries;
- DB not network-exposed;
- service loopback only;
- protected media access checked;
- no stack traces/secrets returned publicly;
- `.env` mode restricted;
- production DB/media not world-readable;
- upload filename is metadata only, never trusted path;
- admin routes role-gated;
- public content routes cannot use IDOR to retrieve a members record.

Nginx security headers should be reasonable without breaking the app.

Do not add an iframe sandbox system to normal photos. `img`/`picture` is correct for images.

Future interactive maps/apps may use sandboxed iframes, following ExNulla's isolation philosophy.

---

# 21. BACKUPS / REVERSIBILITY

Content is valuable.

At minimum implement:

## Pre-deploy DB backup

Before production migrations:

```text
/srv/adlibitumvita/shared/backups/
```

Use SQLite's safe backup API, not a naive copy while a transaction is active.

Name with UTC timestamp + source release SHA where possible.

Keep bounded history.

## Manual backup command

Example:

```bash
npm run db:backup
```

## Content revision history

Admin content saves preserve revision history.

Code rollback and content rollback are separate concerns.

Do NOT rollback the SQLite DB simply because application code rolls back unless a migration is explicitly incompatible. Prefer backward-compatible additive migrations in v1.

---

# 22. TESTS / ACCEPTANCE GATES

Automate the important parts.

At minimum:

## Unit/integration

- migrations apply to empty DB;
- migrations are idempotent/versioned;
- content create/update;
- FTS update/search;
- revision created;
- entitlement authorization;
- unauthenticated member content denied;
- ordinary authenticated user without grant denied;
- active manual grant allowed;
- admin allowed;
- member body does not leak through public endpoint;
- media path validation;
- Markdown sanitizer strips script/event-handler payloads.

## Build

- strict TypeScript passes;
- no `any` shortcuts in app-owned TypeScript;
- public pages build;
- dynamic auth/admin routes build;
- version manifest exists;
- health route exists.

## Production/origin smoke

After deploy:

```text
GET /                      200
GET /login                 200
GET /api/health            200
GET /library               redirect/401 when logged out
GET protected body API     401/403 when logged out
```

Test nginx Host header against loopback even if DNS is pending.

If feasible, use an ephemeral test user/database during CI to exercise login + member route. Do not create hardcoded production users.

---

# 23. ADMIN / USER UX DEFINITION OF DONE

A real operator should be able to do this after creating the first admin:

1. browse to `/login`;
2. login;
3. open `/admin`;
4. click New Entry;
5. choose Captain's Log;
6. enter title/day/date/location/tags/excerpt;
7. paste Markdown prose;
8. attach several photos;
9. set cover/captions/alt text;
10. save draft;
11. publish;
12. see it in `/library/captains-log`;
13. search for a phrase from it;
14. edit it later;
15. create a family user;
16. that family user can login and read it;
17. logged-out browser cannot retrieve the full prose.

The same pipeline must work for Beyond the Map.

Do not make the human SSH into SQLite for ordinary publishing.

---

# 24. README / OPERATIONS DOCUMENTATION

Create a concise operator README.

It must include exact commands for:

```text
development
build
test
database migration
database backup
first admin creation
family user creation (UI preferred)
Markdown dry-run import
Facebook discovery import
manual/direct bootstrap deploy
normal GitHub deploy
rollback
service status
service logs
nginx test
health check
R2 enablement
```

Document paths and environment variables.

Do not write a 100-page architecture essay. Keep operator docs executable.

A separate `docs/architecture.md` may capture the boundaries/decisions.

---

# 25. IMPLEMENTATION ORDER

Optimize for a working deployed vertical slice.

Recommended sequence:

1. inspect environment/reference repos;
2. initialize Astro strict TypeScript app;
3. establish config/env/path abstraction;
4. SQLite connection + migrations;
5. Better Auth + session middleware;
6. access grants;
7. content CRUD + revisions + FTS;
8. public homepage/login;
9. member library/index/detail/search;
10. admin content editor;
11. media local provider + upload;
12. R2 provider interface/config;
13. admin users;
14. import CLI framework;
15. tests/security pass;
16. version/health;
17. systemd;
18. nginx;
19. atomic deploy workflow;
20. GitHub deploy credentials if possible;
21. first commit/push;
22. deploy;
23. production smoke tests;
24. concise final report.

Do not spend the first hour polishing CSS before auth/content/deploy works.

---

# 26. NON-GOALS FOR THIS RUN

Do NOT build:

- Stripe;
- PayPal;
- Patreon;
- public registration;
- comments;
- likes;
- social feed;
- forums;
- complex analytics;
- email marketing;
- mobile app;
- interactive expedition atlas;
- GPS ingestion;
- full Google Photos API integration;
- Facebook OAuth;
- rich text/WYSIWYG;
- multiple databases;
- Docker platform;
- Kubernetes;
- Redis;
- message queue;
- Elasticsearch;
- microservices;
- a custom CMS framework.

Leave clean seams; do not implement them.

---

# 27. CODE QUALITY RULES

- strict TypeScript;
- no `any` in app-owned code;
- no `@ts-ignore` unless a third-party type defect is documented at the exact line;
- no silent catch-and-ignore;
- no fake mocks in production paths;
- no hardcoded secrets;
- no production content in source;
- functions/modules should have narrow responsibilities;
- validate environment at startup;
- validate form/input payloads;
- errors should be actionable;
- use transactions for multi-table content/media changes;
- migrations committed;
- package lock committed;
- do not blindly chase newest beta packages.

Prefer the simplest implementation that satisfies the invariants.

---

# 28. AUTONOMY / FAILURE BEHAVIOR

You are running in dangerous mode, but "dangerous" means autonomous, not careless.

## Allowed machine writes

You may write/modify:

```text
/home/deploy/repos/adlibitumvita/**
/var/www/adlibitumvita/**
/srv/adlibitumvita/**
/etc/nginx/sites-available/adlibitumvita.com
/etc/nginx/sites-enabled/adlibitumvita.com
/etc/systemd/system/adlibitumvita.service
```

and an ALV-specific systemd timer/service if created for backups.

You may add an ALV-specific authorized SSH key for GitHub Actions.

You may reload nginx and daemon-reload/restart ALV service.

## Not allowed

Do not:

- restart unrelated Node/systemd services;
- stop Docker daemon;
- prune Docker globally;
- alter unrelated nginx vhosts;
- edit sibling repos;
- alter existing databases;
- delete unrelated files;
- change firewall rules unless ALV cannot function and the change is narrowly proven necessary;
- change global Node version;
- change global package manager state unnecessarily;
- modify Cloudflare/registrar state without explicit credentials and verified authority;
- expose SQLite or Node port publicly.

## When blocked

If an external human-owned action is necessary, continue every other task.

Examples:

- DNS;
- Cloudflare R2 token;
- production admin credentials;
- GitHub repo permission.

At the end list blockers as:

```text
BLOCKER:
exact condition
exact action/command/UI record needed
everything already completed despite it
```

Do not stop mid-build to ask.

---

# 29. DEPLOYED-SITE DEFINITION OF DONE

This run is successful only when as many of these as technically possible are true:

- [ ] code exists in `Thesis-Web/adlibitumvita`;
- [ ] strict build/tests pass;
- [ ] public homepage implemented;
- [ ] login implemented;
- [ ] no public signup;
- [ ] member library implemented;
- [ ] Captain's Log implemented;
- [ ] Beyond the Map implemented;
- [ ] protected search implemented;
- [ ] admin content CRUD implemented;
- [ ] Markdown editor implemented;
- [ ] multi-photo upload implemented;
- [ ] local protected-media provider works;
- [ ] R2 provider/config seam exists;
- [ ] admin user management implemented;
- [ ] manual access grants implemented;
- [ ] first-admin bootstrap command exists;
- [ ] Markdown importer exists;
- [ ] Facebook `--discover` importer exists;
- [ ] SQLite production path isolated;
- [ ] database backup command exists;
- [ ] revision history exists;
- [ ] `/api/health` works;
- [ ] build provenance exists;
- [ ] systemd service works;
- [ ] nginx vhost works without disturbing existing sites;
- [ ] GitHub atomic deploy workflow exists;
- [ ] GitHub Actions deployment is configured if repo permissions allow;
- [ ] app is deployed to an immutable SHA release;
- [ ] `current` symlink points to good release;
- [ ] origin smoke tests pass;
- [ ] public domain HTTPS works IF DNS/TLS prerequisites are actually available;
- [ ] README contains exact operator commands.

Do not claim a checkbox succeeded unless you tested it.

---

# 30. FINAL RESPONSE FORMAT

At the end, return a terse engineering handoff, not a narrative.

Use exactly these sections:

```text
BUILT
- ...

DEPLOYED
- release SHA:
- current path:
- service:
- port:
- nginx:
- public URL/origin validation:

TESTS
- ...
- ...

ADMIN BOOTSTRAP
<exact command(s)>

PUBLISHING
<exact steps for single entry>

BULK IMPORT
<exact Markdown command>
<exact Facebook discovery command>

GITHUB
- repo visibility:
- workflow:
- deployment status:

DNS / TLS
- actual live NS:
- actual A:
- status:
- exact remaining action if blocked:

R2
- status:
- exact env/credential steps if not configured:

ROLLBACK
<exact command/procedure>

BLOCKERS
- none
```

If there are blockers, replace `none` with only real external blockers.

Do not finish with "would you like me to..." or a long future roadmap.

**Build the thing.**
