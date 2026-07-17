-- Repair bookings where inspections exist but lifecycle status/timestamps are stale.
--
-- Optional: run once if pickup/return status updates fail in the app
--   ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'on_trip';
--   ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending_collection';
--   ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'returned';
--
-- Step 1: Run the PREVIEW query — review rows.
-- Step 2: Run the REPAIR query — applies fixes.
-- Step 3: Run PREVIEW again — should return zero rows.
--
-- Note: status checks use ::text so this works even when 'returned' is not
-- in your booking_status enum yet.

-- ═══════════════════════════════════════════════════════════════════════════════
-- PREVIEW — run this first
-- ═══════════════════════════════════════════════════════════════════════════════
WITH latest_inspections AS (
  SELECT DISTINCT ON (booking_id, type)
    booking_id,
    type,
    created_at,
    conducted_by
  FROM booking_inspections
  ORDER BY booking_id, type, created_at DESC
),
inspection_summary AS (
  SELECT
    l.booking_id,
    pre.created_at AS pre_at,
    pre.conducted_by AS pre_by,
    post.created_at AS post_at,
    post.conducted_by AS post_by
  FROM (SELECT DISTINCT booking_id FROM booking_inspections) l
  LEFT JOIN latest_inspections pre
    ON pre.booking_id = l.booking_id AND pre.type = 'pre_handover'
  LEFT JOIN latest_inspections post
    ON post.booking_id = l.booking_id AND post.type = 'post_return'
  WHERE pre.created_at IS NOT NULL OR post.created_at IS NOT NULL
)
SELECT
  b.id,
  b.status,
  b.sub_status,
  b.pickup_confirmed_at,
  b.return_confirmed_at,
  i.pre_at,
  i.post_at
FROM bookings b
JOIN inspection_summary i ON i.booking_id = b.id
WHERE
  (i.pre_at IS NOT NULL AND b.pickup_confirmed_at IS NULL)
  OR (i.post_at IS NOT NULL AND b.return_confirmed_at IS NULL)
  OR (i.post_at IS NOT NULL AND b.status::text <> 'completed')
  OR (i.pre_at IS NOT NULL AND i.post_at IS NULL AND b.status::text NOT IN ('on_trip', 'completed'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- REPAIR — run after preview looks correct (highlight & run this block only)
-- ═══════════════════════════════════════════════════════════════════════════════
WITH latest_inspections AS (
  SELECT DISTINCT ON (booking_id, type)
    booking_id,
    type,
    created_at,
    conducted_by
  FROM booking_inspections
  ORDER BY booking_id, type, created_at DESC
),
inspection_summary AS (
  SELECT
    l.booking_id,
    pre.created_at AS pre_at,
    pre.conducted_by AS pre_by,
    post.created_at AS post_at,
    post.conducted_by AS post_by
  FROM (SELECT DISTINCT booking_id FROM booking_inspections) l
  LEFT JOIN latest_inspections pre
    ON pre.booking_id = l.booking_id AND pre.type = 'pre_handover'
  LEFT JOIN latest_inspections post
    ON post.booking_id = l.booking_id AND post.type = 'post_return'
  WHERE pre.created_at IS NOT NULL OR post.created_at IS NOT NULL
)
UPDATE bookings b
SET
  pickup_confirmed_at = COALESCE(b.pickup_confirmed_at, i.pre_at),
  pickup_confirmed_by = COALESCE(b.pickup_confirmed_by, i.pre_by),
  return_confirmed_at = COALESCE(b.return_confirmed_at, i.post_at),
  return_confirmed_by = COALESCE(b.return_confirmed_by, i.post_by),
  status = CASE
    WHEN i.post_at IS NOT NULL THEN 'completed'::booking_status
    WHEN i.pre_at IS NOT NULL THEN 'on_trip'::booking_status
    ELSE b.status
  END,
  sub_status = CASE
    WHEN i.post_at IS NOT NULL THEN 'completed'
    WHEN i.pre_at IS NOT NULL THEN 'in_transit'
    ELSE b.sub_status
  END
FROM inspection_summary i
WHERE b.id = i.booking_id
  AND (
    (i.pre_at IS NOT NULL AND b.pickup_confirmed_at IS NULL)
    OR (i.post_at IS NOT NULL AND b.return_confirmed_at IS NULL)
    OR (i.post_at IS NOT NULL AND b.status::text <> 'completed')
    OR (i.pre_at IS NOT NULL AND i.post_at IS NULL AND b.status::text NOT IN ('on_trip', 'completed'))
  );
