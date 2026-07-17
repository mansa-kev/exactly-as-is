-- ============================================================
-- Migration: blog_posts + car_reviews + cars rating columns
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Blog Posts Table
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  published_at TIMESTAMPTZ,
  meta_title TEXT,
  meta_description TEXT,
  keywords TEXT,
  read_time_minutes INTEGER DEFAULT 3,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Car Reviews Table
CREATE TABLE IF NOT EXISTS car_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add rating columns to cars table (if not already there)
ALTER TABLE cars ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- 4. Function to recalculate car rating after review approval
CREATE OR REPLACE FUNCTION update_car_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cars
  SET
    average_rating = (
      SELECT ROUND(AVG(rating)::NUMERIC, 2)
      FROM car_reviews
      WHERE car_id = COALESCE(NEW.car_id, OLD.car_id)
        AND status = 'approved'
    ),
    review_count = (
      SELECT COUNT(*)
      FROM car_reviews
      WHERE car_id = COALESCE(NEW.car_id, OLD.car_id)
        AND status = 'approved'
    )
  WHERE id = COALESCE(NEW.car_id, OLD.car_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger to auto-update rating when review status changes
DROP TRIGGER IF EXISTS on_review_change ON car_reviews;
CREATE TRIGGER on_review_change
  AFTER INSERT OR UPDATE OR DELETE ON car_reviews
  FOR EACH ROW EXECUTE FUNCTION update_car_rating();

-- 6. Updated_at triggers
DROP TRIGGER IF EXISTS blog_posts_updated_at ON blog_posts;
CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS car_reviews_updated_at ON car_reviews;
CREATE TRIGGER car_reviews_updated_at
  BEFORE UPDATE ON car_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. RLS Policies — blog_posts
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published blog posts" ON blog_posts;
CREATE POLICY "Public can read published blog posts"
  ON blog_posts FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "Admins can manage all blog posts" ON blog_posts;
CREATE POLICY "Admins can manage all blog posts"
  ON blog_posts FOR ALL
  USING (is_admin());

-- 8. RLS Policies — car_reviews
ALTER TABLE car_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read approved reviews" ON car_reviews;
CREATE POLICY "Public can read approved reviews"
  ON car_reviews FOR SELECT
  USING (status = 'approved');

DROP POLICY IF EXISTS "Authenticated users can submit reviews" ON car_reviews;
CREATE POLICY "Authenticated users can submit reviews"
  ON car_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own reviews" ON car_reviews;
CREATE POLICY "Users can view their own reviews"
  ON car_reviews FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all reviews" ON car_reviews;
CREATE POLICY "Admins can manage all reviews"
  ON car_reviews FOR ALL
  USING (is_admin());

-- 9. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_car_reviews_car_id ON car_reviews(car_id);
CREATE INDEX IF NOT EXISTS idx_car_reviews_status ON car_reviews(status);
CREATE INDEX IF NOT EXISTS idx_car_reviews_booking_id ON car_reviews(booking_id);
