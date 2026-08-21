-- Better Auth core schema (email/password + admin plugin), generated via
-- `better-auth generate` against src/lib/auth.ts and committed verbatim.
-- Better Auth owns these tables; application code only reads them (see
-- src/lib/users.ts, src/lib/entitlements.ts).

CREATE TABLE IF NOT EXISTS "user" (
  "id" text not null primary key,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" integer not null,
  "image" text,
  "createdAt" date not null,
  "updatedAt" date not null,
  "role" text,
  "banned" integer,
  "banReason" text,
  "banExpires" date
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text not null primary key,
  "expiresAt" date not null,
  "token" text not null unique,
  "createdAt" date not null,
  "updatedAt" date not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user" ("id") on delete cascade,
  "impersonatedBy" text
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" text not null primary key,
  "issuer" text not null,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" date,
  "refreshTokenExpiresAt" date,
  "scope" text,
  "password" text,
  "createdAt" date not null,
  "updatedAt" date not null
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text not null primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" date not null,
  "createdAt" date not null,
  "updatedAt" date not null
);

CREATE INDEX IF NOT EXISTS "session_userId_idx" on "session" ("userId");
CREATE INDEX IF NOT EXISTS "account_userId_idx" on "account" ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "account_issuer_accountId_idx" on "account" ("issuer", "accountId");
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" on "verification" ("identifier");
