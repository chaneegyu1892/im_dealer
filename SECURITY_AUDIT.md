# User PII and identity-verification security audit

Date: 2026-08-12  
Scope: Kakao/Supabase authentication, sessions, user PII, Korean resident registration number (RRN), Codef identity verification and documents, admin access, telemetry, retention, and secrets.

## Executive verdict

**Current handling is not yet sufficient for production processing of identity documents and high-risk PII.**

The current user flow does **not** send or store a full RRN. It accepts the first six digits and only the first digit of the back half in browser memory, derives an eight-digit birth date, clears the RRN fragments, and sends only the derived birth date. This disproves the initial plaintext-full-RRN hypothesis for the active flow.

There are also meaningful safeguards: authenticated owner checks, server-side role checks, AES-256-GCM field encryption, encrypted document storage, a 90-day purge job, PKCE-based Supabase OAuth, telemetry scrubbing, and suppression of ChannelTalk on the RRN page.

However, the following issues prevent a sufficient verdict:

1. The repository does not establish RLS or explicit Data API grant revocation for the PII-bearing Prisma tables in Supabase's exposed `public` schema. If Supabase's `anon` or `authenticated` roles retain grants, the public browser key can bypass the Next.js authorization layer. This must be checked against the deployed database immediately.
2. Staff APIs decrypt and return complete Codef response objects, even though the UI uses only a few status fields. All staff can also download every retained identity document by ID, with no sensitive-read audit trail or MFA/AAL requirement.
3. Retention and account-deletion behavior is incomplete. Failed/pending verification data is not covered by the 90-day purge predicates, and no user withdrawal/deletion flow was found despite the privacy notice promising retention until withdrawal.
4. The single application encryption key has no key identifier, rotation mechanism, or record/field binding, and is shared with worker credentials and Kakao refresh tokens.

This is a source review, not a penetration test or legal opinion. Supabase project settings, live grants/policies, backups, Vercel controls, Codef contracts, Kakao console settings, staff procedures, and production logs were not available in the repository and require separate verification.

## Severity summary

| Severity | Count | Findings |
| --- | ---: | --- |
| Critical | 1 | C-01 |
| High | 5 | H-01 through H-05 |
| Medium | 8 | M-01 through M-08 |
| Low | 3 | L-01 through L-03 |
| Info | 2 | I-01 through I-02 |

## Critical

### C-01 — PII tables have no repository-managed Supabase RLS or Data API grant lockdown

**Evidence**

- `prisma/schema.prisma:5-9` creates PostgreSQL models through Prisma without a private schema.
- `src/lib/supabase/client.ts:3-7` puts the Supabase URL and anonymous key in the browser, as expected for Supabase clients.
- The only `ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` statements found in migrations concern `quota_log`: `prisma/migrations/20260717000000_reconcile_production_schema_drift/migration.sql:47-70`.
- No RLS/grant controls were found for `User`, `SavedQuote`, `CustomerVerification`, `VerificationDocument`, `AdminAuditLog`, or other application tables.
- Sensitive models include plaintext user/contact fields (`prisma/schema.prisma:657-680`) and encrypted verification/document fields (`prisma/schema.prisma:761-807`).

**Live verification (production, 2026-08-12)**

- `anon` and `authenticated` had no table grants, and a direct REST request was denied with PostgreSQL error `42501`.
- RLS is now enabled on `public."VerificationDocument"` with no permissive policies.
- `EXECUTE` on `public.rls_auto_enable()` was revoked from `anon`, `authenticated`, and `PUBLIC`.

**Risk**

Supabase exposes configured schemas through PostgREST. RLS is the security boundary when browser clients can reach tables through the Data API. If `anon` or `authenticated` has table privileges in production, missing RLS can permit direct reads or writes that completely bypass Next.js authentication and role checks. Encryption reduces the impact for four verification fields and document bodies, but names, phones, emails, quote contacts, metadata, and ciphertext remain exposed. Unauthorized writes could also corrupt identity decisions.

The repository proves that controls are absent from migrations; it does not prove the deployed role grants. Treat this as critical until a live database check proves that exposed roles have no access.

**Remediation**

1. Immediately inventory production with `pg_tables`, `pg_class.relrowsecurity`, `information_schema.role_table_grants`, `pg_policies`, exposed schemas, and direct REST tests using the public anonymous key.
2. For tables used only through Prisma, move them to a non-exposed schema or revoke all privileges from `anon` and `authenticated`; also enable RLS as defense in depth with no permissive policy.
3. For any table intentionally accessed through Supabase Data API, enable RLS and add operation-specific owner/role policies. Do not authorize from user-editable `user_metadata`.
4. Add a migration and CI test that fails when a PII-bearing table is exposed without RLS/grant lockdown.
5. Review views and `SECURITY DEFINER` functions as separate exposure paths.

## High

### H-01 — APIs decrypt and return much more verification data than the UI needs

**Status (2026-08-12): Fixed.** Verification lists now select metadata only. Both staff detail APIs use explicit projections and return only status metadata, three allowlisted UI display strings, and safe document metadata; they no longer return `connectedId`, raw Codef objects, or document ciphertext.

**Evidence**

- `src/app/api/verification/[id]/route.ts:18-29` loads the entire verification row and returns `decryptVerificationRow(record)`.
- `src/app/api/verification/session/[sessionId]/route.ts:29-56` excludes document bodies but still decrypts and returns all verification fields, including `connectedId` and complete Codef objects.
- `src/lib/admin-queries/verifications.ts:19-40` fetches full rows, decrypts three raw Codef payloads, and includes them in the list API. The list page uses statuses and dates only (`src/app/(admin)/admin/verifications/page.tsx:96-129`).
- The detail UI extracts only a license status, workplace name, and business status (`src/components/admin/VerificationResult.tsx:298-375`).

**Risk**

A compromised staff session, browser extension, XSS, support recording, or accidental client logging receives complete decrypted upstream payloads rather than the minimum display projection. These payloads can include license, insurance, employment, and business information that is never rendered. This confirms the “returned too broadly” portion of the initial hypothesis.

**Remediation**

1. Replace full-row responses with explicit Prisma `select` projections.
2. Convert encrypted provider responses to an allowlisted, minimal server-side view model; never return `connectedId` or raw Codef objects to the browser.
3. Remove raw fields from the recent-verifications list entirely.
4. Retire or restrict the unused ID-based full-record endpoint.
5. Add response-shape tests asserting that encrypted/raw keys cannot appear.

### H-02 — Sensitive-document access is broad, unassigned, and not audited

**Step 1 status (implemented)**

- Successful authorized reads through both verification detail routes and the identity-document download route now create audit records with the actor, action, relevant verification/session/document IDs, request IP (when available through the existing trusted-proxy handling), user agent, and server timestamp.
- Audit metadata is identifier-only; document bytes, encrypted content, provider JSON, RRN, phone, filenames, and other raw PII are not included. The frequently polled verification list remains unaudited to avoid noisy low-value events.
- Remaining gaps: narrow access to a dedicated reviewer/assigned case or break-glass flow, require MFA/step-up authentication, and add volume/anomaly alerting.

**Evidence**

- Any `staff` or higher role can access verification results: `src/app/api/verification/[id]/route.ts:12`, `src/app/api/verification/session/[sessionId]/route.ts:12`, and `src/app/api/admin/verifications/route.ts:7`.
- Any `staff` or higher role can download any retained document when given its ID: `src/app/api/verification/documents/[docId]/route.ts:12-16`.
- The download route correctly uses `Cache-Control: no-store` (`route.ts:33-40`) but records no read/download audit event.
- The audit action set and call sites cover many mutations but no verification read or document download (`src/lib/audit.ts:18-88`; no `logAdminAction` call exists under `src/app/api/verification`).

**Risk**

All staff accounts have organization-wide access to highly sensitive documents without case assignment, purpose checks, step-up authentication, or a forensic record. An insider or stolen staff session can browse and download documents with little detection.

**Remediation**

1. Create a dedicated least-privilege permission such as `verification_reviewer`; do not infer it solely from the broad staff hierarchy.
2. Enforce quote/case assignment or an approved break-glass reason server-side.
3. Require Supabase MFA with an appropriate AAL and recent reauthentication before decrypted detail or download access.
4. Log actor, document/verification ID, case ID, action, timestamp, IP, and declared purpose. Never put document content or raw PII into the audit diff.
5. Alert on unusual volume and repeated access across unrelated customers.

### H-03 — Admin access to PII has no MFA/step-up enforcement

**Evidence**

- Admin identity is the same Supabase/Kakao session used for members; authorization is a local DB role (`src/lib/admin-auth.ts:12-35`).
- Role checks correctly use the DB and active status rather than user-editable metadata (`src/proxy.ts:133-151`).
- No check of Supabase `aal`, MFA enrollment, recent login, or reauthentication was found before user lists, raw verification results, or document downloads.

**Risk**

Kakao account compromise or theft of a script-readable Supabase browser session is sufficient to access staff PII functions. The impact is amplified by H-01 and H-02.

**Remediation**

Require MFA for all privileged roles, verify AAL server-side for sensitive routes, use short privileged-session lifetimes, and require step-up/recent authentication for document downloads and role changes. Review staff role enrollment and recovery procedures outside the codebase.

### H-04 — Retention and withdrawal deletion are incomplete

**Evidence**

- The purge only processes verification rows with `verifiedAt < cutoff` (`src/app/api/cron/purge-pii/route.ts:44-61`) and documents with `issuedAt < cutoff` (`route.ts:64-75`).
- Failed or abandoned attempts can have plaintext `failReason`, metadata, and timestamps but no `issuedAt`; they are never selected.
- Failed document errors are stored as plaintext (`src/app/api/verification/easyauth/complete/route.ts:37-48`).
- The privacy notice states membership/service data is retained until withdrawal (`src/app/(public)/privacy/page.tsx:188-199`), but no member account withdrawal/deletion implementation was found.
- `User` PII and encrypted Kakao refresh tokens have no repository-defined expiration (`prisma/schema.prisma:657-680`).

**Risk**

Abandoned, failed, and account-level PII can be retained indefinitely, contrary to minimization and the application's own notice. A database or staff-account compromise therefore affects more people and more historical data than necessary.

**Remediation**

1. Base verification retention on `createdAt`/last activity as well as success timestamps, covering pending, failed, and abandoned states.
2. Sanitize failure codes at ingestion; do not persist raw provider error text.
3. Implement tested account withdrawal that revokes Supabase sessions, deletes or irreversibly anonymizes local PII, handles legally required segregated records, and revokes/deletes the Kakao refresh token.
4. Record deletion outcomes and alert on purge failures.
5. Align the code, backup expiration, vendor deletion, and published retention schedule.

### H-05 — Two account mutation APIs did not reject inactive users

**Evidence**

- `getCurrentUser()` deliberately returns inactive users and requires callers to enforce status (`src/lib/admin-auth.ts:11-25`).
- The profile-completion and marketing-consent routes originally checked only whether `getCurrentUser()` returned a row, unlike the verification and quote APIs that use `requireActiveUser()`.
- Deactivation updates the local database flag but does not revoke the user's existing Supabase session (`src/app/api/admin/settings/users/route.ts`).

**Risk**

After staff deactivation, a user with an existing Supabase session could still modify their profile and marketing-consent state through direct API calls.

**Remediation/status**

The accompanying hardening change replaces both checks with `requireActiveUser()` and adds inactive-account regression tests. Production deactivation should also revoke all Supabase sessions and, according to the chosen disconnect policy, remove the stored Kakao refresh token.

## Medium

### M-01 — Encryption has no key rotation or context binding and shares one key across data classes

**Evidence**

- AES-256-GCM uses random 12-byte IVs and authentication tags (`src/lib/pii.ts:68-80`), which is a sound primitive.
- The envelope contains only version, IV, tag, and ciphertext (`src/lib/pii.ts:14-21`): there is no key ID.
- No additional authenticated data binds ciphertext to a user, row, table, or field.
- The same `PII_ENCRYPTION_KEY` encrypts verification payloads, documents, connected IDs, Kakao refresh tokens, and scraper credentials.
- Legacy plaintext is deliberately returned as valid data (`src/lib/pii.ts:83-124`).

**Risk**

There is no online rotation path, compromise of one application/worker key exposes multiple data classes, and valid ciphertext can be copied between compatible fields/records without cryptographic detection. Legacy plaintext may remain unnoticed after a partial backfill.

**Remediation**

Adopt an envelope format with `keyId`, algorithm/version, and AAD containing stable context such as table/field/record ID. Separate keys by data class and environment, store keys in a managed KMS/secret manager, support decrypt-old/encrypt-new rotation, and add a production invariant scan that rejects legacy plaintext. Design and test this as a migration; do not patch the existing format ad hoc.

### M-02 — General account and quote PII is plaintext at the application layer

**Evidence**

- Names, emails, phone numbers, Kakao IDs/nicknames, and quote contacts are ordinary text fields (`prisma/schema.prisma:657-680`; `src/lib/admin-queries/users.ts:220-253`).
- Staff user APIs aggregate and return broad user/contact profiles (`src/app/api/admin/users/route.ts:6-12`; `src/lib/admin-queries/users.ts:298-475`).

**Risk**

Managed-database disk encryption does not protect against SQL credential theft, Data API authorization errors, database exports, or overprivileged staff/application access.

**Remediation**

First fix C-01 and least privilege. Then classify fields and apply field encryption/tokenization only where justified. Use keyed, purpose-specific indexes/tokens for exact matching; do not use unsalted hashes for low-entropy phone numbers. Mask list views and reveal full contact data only on a case with audit logging.

### M-03 — Returned PDFs are not bounded or validated before storage/download

**Evidence**

- Codef `pdfBase64` is accepted as any non-empty string (`src/lib/codef/easyauth.ts:199-210`).
- It is encrypted and stored without decoded-size limit, PDF magic validation, page limits, or malware/content scanning (`src/app/api/verification/easyauth/complete/route.ts:35-59`).
- Downloads use `attachment`, `nosniff` globally, and `no-store`, which reduces browser execution risk.

**Risk**

A malformed or unexpectedly large provider response can cause memory/database pressure or deliver a hostile PDF to staff. This is a supplier/integration risk rather than an unauthenticated user-upload risk.

**Remediation**

Decode with a strict maximum size, validate base64 and `%PDF-` structure, reject polyglots where practical, scan with an isolated malware service, and record only safe failure codes. Keep download disposition and no-store headers.

### M-04 — Telemetry redaction does not cover all identity-flow field names

**Evidence**

- The Sentry scrubber masks full RRN, phone, email, license patterns and several sensitive keys (`src/lib/sentry-scrubber.ts:13-55`).
- Identity request keys such as `userName`, `birthDate`, `phoneNo`, `pdfBase64`, `contentEnc`, `docVerifyNo`, `twoWayInfo`, and `jti` are not key-redacted.
- Names and eight-digit birth dates have no general pattern rule.

**Risk**

If an exception SDK, breadcrumb, future logger, or manually attached context includes request data, these values can leave the service boundary. Pattern-only filtering is not adequate for names and birth dates.

**Remediation**

Add all identity-flow keys to denylist redaction, avoid attaching request bodies by configuration, test server/client/edge events with representative payloads, and verify Sentry data residency, retention, and processor disclosures. Prefer allowlisting telemetry fields on sensitive routes.

### M-05 — Session/XSS defenses rely on script-readable auth cookies while CSP is report-only

**Evidence**

- `@supabase/ssr` is used for browser/server sessions (`src/lib/supabase/client.ts` and `server.ts`). Supabase's SSR design makes tokens available to browser code; setting `HttpOnly` is not a drop-in fix.
- ChannelTalk is explicitly removed from `/verify` because same-document scripts can read RRN input (`src/lib/channel-talk.ts:11-18`; `src/components/layout/ChannelTalk.tsx:28-33`).
- CSP is only `Content-Security-Policy-Report-Only` and permits `'unsafe-inline'` and `'unsafe-eval'` (`next.config.mjs:35-64`).

**Risk**

An XSS anywhere in the origin can steal a long-lived session/refresh token. On the verification page it can also read partial RRN, name, phone, birth date, and two-way authentication state. ChannelTalk suppression is good but does not create an isolated origin.

**Remediation**

Move from report-only to an enforced nonce/hash-based CSP, eliminate `unsafe-eval` in production, reduce third-party scripts, and consider hosting the verification flow on an isolated origin with no marketing scripts. Keep Supabase's supported cookie model unless the application is redesigned as a server-only session/BFF.

### M-06 — Consent evidence is too weak for a sensitive-document workflow

**Evidence**

- The server stores only a client-supplied timestamp and customer type (`src/app/api/verification/consent/route.ts:12-16,97-107`).
- It does not store notice/consent version, purposes, itemized selections, retention term, processors/recipients, withdrawal route, or server receipt timestamp as distinct evidence.
- The UI presents two required toggles but posts neither toggle values nor a policy version (`src/app/(public)/verify/VerifyClient.tsx:163-177,556-564`).

**Risk**

The organization cannot reliably prove exactly what notice and terms a user accepted. Published retention is also less specific than the code's 90-day identity-data behavior.

**Remediation**

Use immutable, versioned consent receipts with server timestamps, purpose/item/retention/recipient versions, locale, and withdrawal status. Keep the receipt free of document contents. Have Korean privacy counsel review the legal basis, required notices, outsourcing/international-transfer disclosures, and whether each collected document is necessary.

### M-07 — Kakao token/account lifecycle is incomplete

**Evidence**

- Kakao refresh tokens are encrypted and rotation responses are stored (`src/lib/kakao/token.ts:20-37,65-94`).
- Normal logout calls Supabase `signOut()` in the browser (`src/components/layout/MyMenuButton.tsx:93-100`; `src/components/admin/AdminSidebar.tsx:97-101`) but does not delete/revoke the stored Kakao refresh token.
- The server `/api/admin/auth/logout` route deletes only an E2E cookie and does not sign out Supabase (`src/app/api/admin/auth/logout/route.ts:6-21`).
- No Kakao unlink/account-disconnect flow or explicit account-linking policy was found.

**Risk**

Provider credentials persist without a user-facing revocation path, and logout behavior is split across an effectively unrelated server endpoint and browser calls. Duplicate or changed provider identities fail safely through unique constraints but have no recovery/linking design.

**Remediation**

Define logout versus disconnect versus withdrawal semantics. Provide a disconnect/withdrawal path that revokes Kakao authorization where applicable and deletes local refresh-token ciphertext. Consolidate logout behavior, handle errors, and document safe linking/recovery rules requiring recent authentication.

### M-08 — Easy-auth completion did not repeat the document-purpose policy check

**Evidence**

- The start endpoint validates that the requested document is allowed for the verification's customer type (`src/app/api/verification/easyauth/start/route.ts:26-36`).
- The completion endpoint originally checked ownership only before making the paid Codef request.

**Risk**

An authenticated owner could bypass the UI and submit a completion request for a document outside the purpose/customer-type policy, causing out-of-policy collection and paid API usage.

**Remediation/status**

The accompanying hardening change now loads the verification customer type and repeats the same allowlist check before calling Codef. A regression test confirms disallowed document types do not reach the provider.

## Low

### L-01 — CSRF protection is implicit rather than explicitly enforced

Supabase's PKCE flow is the correct OAuth baseline, `getUser()` is used server-side, and SameSite `Lax` cookies normally block cross-site POST cookie attachment. Mutating APIs do not independently validate `Origin`/`Referer` or use a CSRF token. Add strict origin checks to sensitive cookie-authenticated mutations as defense in depth, and test OAuth state/PKCE behavior against the deployed Supabase/Kakao configuration.

### L-02 — Production HTTPS is not validated at configuration load

`NEXT_PUBLIC_APP_URL` accepts any URL (`src/lib/env.ts:20-22`), and callback origin validation accepts both HTTP and HTTPS (`src/app/auth/callback/route.ts:205-219`). HSTS is configured globally, but production should fail startup unless the public app URL is HTTPS and Kakao/Supabase redirect allowlists contain only canonical production URLs.

### L-03 — No automated repository secret scanner was found

`.env` files, worker state, captures, dumps, and credentials are broadly ignored (`.gitignore:31-51,94-99`), and no apparent real secret was found in the current tracked tree. CI does not appear to run a secret scanner. Add secret scanning and push protection, scan full history with redacted output, rotate anything found, and prohibit production secrets in test fixtures or documentation.

## Informational

### I-01 — No user identity-document upload bucket exists in the reviewed flow

Identity documents are fetched server-to-server from Codef and stored as encrypted JSON in PostgreSQL (`src/app/api/verification/easyauth/complete/route.ts:35-59`), not uploaded by users to Supabase Storage. Therefore bucket ACLs and signed URLs do not currently control identity documents.

The public `quotes` bucket (`prisma/migrations/20260720020000_quote_image_storage_bucket/migration.sql`) and public review/admin/vehicle image helpers (`src/lib/supabase/storage.ts`) concern non-identity images. They should be reviewed separately for content abuse, but they are not evidence that identity PDFs are public.

### I-02 — Full RRN is not collected in the active UI flow

**Evidence**

- The UI stores only six front digits and one back digit (`src/app/(public)/verify/VerifyClient.tsx:28-35,361-390`).
- It derives an eight-digit birth date locally and clears both fragments (`VerifyClient.tsx:541-577`).
- Consent and easy-auth requests send the birth date, name, and phone—not RRN fragments (`VerifyClient.tsx:556-565`; `src/app/(public)/verify/EasyAuthStep.tsx:94-118`).
- The helper rejects a full seven-digit back half (`src/lib/resident-registration.ts`; corresponding tests in `resident-registration.test.ts`).

The fragments still exist briefly in DOM/React memory, so XSS, browser extensions, screen capture, and compromised devices remain relevant. Keep the page isolated, mark both inputs `autocomplete="off"`/appropriate privacy attributes, avoid analytics/session replay, and do not regress to full RRN collection. Stale internal documentation that describes sending a full 13-digit RRN (`docs/codef-document-spec.md:40-41,86`) should be removed or clearly marked historical.

## Controls already implemented well

- Supabase SSR uses PKCE by default, and the callback exchanges an authorization code rather than handling tokens in a URL fragment (`src/app/auth/callback/route.ts:19-35`).
- Redirect destinations are constrained to internal paths (`src/lib/kakao/client-auth.ts:15-21`; `src/lib/auth/redirect.ts`).
- Server authorization calls `supabase.auth.getUser()` and maps to an active local user. Admin roles come from the database, not user-editable Supabase metadata (`src/lib/admin-auth.ts:17-35`; `src/proxy.ts:133-151`).
- Inactive users are globally signed out at callback (`src/app/auth/callback/route.ts:39-54`).
- New verification records are bound to the authenticated Supabase user, and member routes query by both record ID and owner (`src/app/api/verification/consent/route.ts:65-108`; easy-auth and fetch routes).
- Login-before-quote ownership uses a random capability, SHA-256 storage, timing-safe comparison, an HTTP-only scoped cookie, and an atomic claim (`src/lib/verification-capability.ts`; `src/app/api/verification/consent/route.ts:65-95`).
- Verification PII, document bodies, document verification numbers, and Kakao refresh tokens use AES-256-GCM with random IVs and authenticated tags. Production startup requires a 32-byte key (`src/lib/pii.ts`; `src/lib/env.ts:28-35`).
- Raw Codef document contents are not returned to members; successful member responses contain only status (`src/app/api/verification/easyauth/complete/route.ts:62-70`; `src/app/api/verification/fetch/route.ts:127-140`).
- Document downloads use attachment disposition and `Cache-Control: no-store` (`src/app/api/verification/documents/[docId]/route.ts:32-40`).
- A timing-safe secret check protects the daily 90-day purge, and purge failures are surfaced to Sentry (`src/app/api/cron/purge-pii/route.ts:29-41,118-129`; `vercel.json:3-5`).
- Sentry has centralized before-send scrubbing across client/server/edge, and ChannelTalk is removed from the verification route (`src/lib/sentry-before-send.ts`; `src/lib/channel-talk.ts`).
- Baseline security headers include HSTS, frame denial, MIME sniffing prevention, referrer policy, and permissions policy (`next.config.mjs:50-64`).
- Kakao refresh tokens are encrypted and provider rotation is handled (`src/lib/kakao/token.ts:20-37,90-94`).
- No real secret was observed in the current tracked tree; public keys are appropriately named `NEXT_PUBLIC_*`, while service-role, Kakao, Codef, cron, and encryption secrets are server environment variables.

## Prioritized remediation plan

### Immediate

1. Verify live Supabase grants/RLS and block Data API access to every Prisma-only table.
2. Stop returning raw decrypted Codef payloads and `connectedId` to admin browsers.
3. Restrict document/result access to a dedicated reviewed role, require MFA/step-up, and audit every read/download.
4. Confirm that the production encryption key is present, backed up securely, access-limited, and that no legacy plaintext remains.

### Next

1. Fix retention for failed/pending/abandoned records and implement account withdrawal/deletion.
2. Add PDF size/type/malware controls.
3. Enforce CSP and expand telemetry redaction.
4. Version consent receipts and reconcile the privacy notice with actual retention, vendors, and international processing.

### Architectural

1. Design versioned envelope encryption with KMS-backed, separated, rotatable keys and contextual AAD.
2. Move sensitive tables to a non-exposed database schema and formalize least-privilege database roles.
3. Build privileged-access governance: staff assignment, MFA, step-up, read audit, alerting, periodic access review, and break-glass handling.

## Deployment checks required before approval

- Supabase exposed schemas, table/view/function grants, RLS status/policies, storage bucket policies, auth redirect allowlists, session/JWT lifetime, MFA settings, and identity-linking settings.
- PostgreSQL TLS, backup encryption, backup retention/deletion, point-in-time recovery retention, database role permissions, and query/log redaction.
- Vercel environment scopes, secret access/audit history, preview-deployment protection, log drains, and HTTPS-only canonical domain behavior.
- Kakao app redirect URIs, client-secret use, requested scopes, unlink behavior, consent records, and token revocation.
- Codef transport/contract, subprocessor/data-location terms, response retention, deletion, and incident notification.
- Sentry and ChannelTalk data fields, region, retention, session-replay settings, processor terms, and deletion support.
- Operational evidence for staff training, joiner/mover/leaver reviews, incident response, access reviews, and data-subject request handling.

## KR compliance-oriented notes

These are engineering gap indicators, not legal advice.

- Continue avoiding full RRN. Before ever collecting it, obtain Korean counsel review of statutory authority, alternatives, consent limitations, encryption, access logging, and required notices; consent alone may not be a sufficient basis for processing an RRN.
- Document necessity for each identity document and each field within it. Prefer a verification assertion or extracted minimum over retaining a full PDF.
- Separate purposes (account, quote, identity verification, marketing), collect independent consent where required, and prevent secondary use.
- Publish precise retention/deletion periods for verification attempts, successful documents, failed attempts, account PII, logs, backups, and vendors.
- Disclose processors, recipients, and any overseas transfer/storage with the details required for the actual vendor configuration.
- Provide accessible withdrawal, correction, deletion, and consent-revocation workflows, with legally required exceptions segregated from active service data.
- Keep immutable access records for high-risk PII and periodically review who can access it.
