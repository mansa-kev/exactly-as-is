## Audit summary

I scanned all 9 client modules (`src/components/client/*.tsx`). Below is the current state and what I'll do to make each one fully functional + bidirectionally synced with the admin portal. Where the admin already writes/reads a record, I'll wire the client to the same table with realtime subscriptions and the same RLS-friendly service calls used elsewhere in the app.

## Per-module status & plan

### 1. Dashboard (`Dashboard.tsx`)
**Now:** Loads user only; metrics/widgets are static.
**Fix:** Pull live KPIs — active bookings, upcoming pickup, total spend, loyalty points, glovebox completeness, unread inbox. Add quick-action buttons that deep-link to the relevant module. Realtime refresh when admin updates a booking status.

### 2. My Bookings (`MyBookings.tsx`)
**Now:** Real Supabase query + realtime channel already in place. Cancel works. No extend/contract-view/receipt actions.
**Fix:**
- "View Contract" button → open the signed contract PDF (already stored by admin/Step 4).
- "Request Extension" → writes to `booking_extensions` (or `contact_messages` fallback) so admin sees it under Bookings Management → Action Required.
- "Download Receipt" once paid.
- Filter chips (Upcoming / Active / Past / Cancelled) matching admin's tabs.

### 3. Browse & Book (`BrowseAndBook.tsx`)
**Now:** Search input but no live data wiring visible.
**Fix:** Fetch from same `cars` query the public showroom uses, with availability filter respecting admin-set blackout dates. Card → routes into the booking flow with pre-filled client data (already auto-fills in Step 2 via glovebox).

### 4. Digital Glovebox (`DigitalGlovebox.tsx`)
**Now:** Reads glovebox docs.
**Fix:** Make upload/replace/delete write through `clientService.updateGloveboxData` — exactly the same record admin reads under user verification. Reuse the hardened DocumentSlot pattern from Step 2 (no page refresh on mobile, X delete icon, instant thumbnail).

### 5. My Inbox (`MyInbox.tsx`)
**Now:** UI for chat, extension request, support ticket, but no Supabase wiring visible.
**Fix:** All three flows write to existing admin-side tables:
- Chat messages → `support_threads` / `support_messages` (or `contact_messages` if those don't exist yet — I'll check).
- Extension request → same table My Bookings uses, with the booking_id reference.
- New support ticket → `contact_messages` (what admin already reads).
- Realtime subscription so admin replies appear instantly.

### 6. My Profile (`MyProfile.tsx`)
**Now:** Form fields, no save handler wired to DB visible.
**Fix:** Save to `user_profiles` (same row admin edits). Avatar upload to storage bucket. Phone/email/license stay in sync — if admin updates verification status, client sees the badge update live.

### 7. Loyalty Rewards (`LoyaltyRewards.tsx`)
**Now:** Reads user; promo codes appear local.
**Fix:** Read points + tier from `user_profiles` / `loyalty_ledger` (whichever exists — I'll detect). Promo codes pulled from admin-managed `promo_codes` table. "Copy code" already works; add "Apply at checkout" deep link.

### 8. Settings (`Settings.tsx`)
**Now:** Password reset works. Export data is stubbed.
**Fix:**
- Export data → server-side function that bundles bookings + profile + glovebox into a JSON download.
- Notification preferences → write to `user_profiles.notification_prefs` so admin's notification engine respects them.
- Delete account → soft-delete request that lands in admin inbox.

### 9. Client Layout (`ClientLayout.tsx`)
**Now:** Nav shell.
**Fix:** Badge counts on Inbox (unread messages) and Bookings (action-required count), driven by the same realtime channels.

## Cross-cutting fixes

- One shared `clientService` module (extend existing) for every read/write so admin and client always hit the same tables.
- Realtime channels on `bookings`, `support_messages`, `notifications`, `user_profiles` — already proven in `MyBookings.tsx`.
- Loading/empty/error states standardized across all modules.
- Mobile: reuse the Step 2 upload pattern (button + ref, no `<label>`) everywhere a file is picked.

## Execution batches

I'll ship this in 3 batches so you can verify between each:

1. **Batch A — data sync foundations**: Dashboard live KPIs, Profile save, Glovebox upload/delete, ClientLayout badges.
2. **Batch B — bidirectional actions**: My Bookings (contract/extend/receipt), My Inbox (chat + tickets + extension).
3. **Batch C — finishing touches**: Browse & Book filters, Loyalty live data, Settings (export/notifications/delete).

## Things I need from you to start

- Confirm there is **no design change** wanted — I'll preserve the current look and only wire/fix behavior.
- For "Request Extension" and "Support Ticket": should they land in the existing **Bookings Management → Action Required** and **Communication → Messages** lists in admin, or do you want a dedicated new admin view? (Default: reuse existing.)
- Is the loyalty system already designed (points formula, tier thresholds) or should I propose one?

Once you approve, I'll start with Batch A.