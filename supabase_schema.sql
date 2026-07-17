-- ===============================================================
-- Master Database Schema: LinkedUp Cars Rentals
-- ===============================================================

-- ENUMS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'fleet_owner', 'client', 'driver');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'car_status') THEN
        CREATE TYPE car_status AS ENUM ('available', 'rented', 'maintenance', 'unavailable');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'maintenance_status') THEN
        CREATE TYPE maintenance_status AS ENUM ('ok', 'due', 'in_progress');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
        CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'pending_payment_verification');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
        CREATE TYPE transaction_type AS ENUM ('payment_in', 'payout_out', 'refund');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') THEN
        CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fleet_owner_status') THEN
        CREATE TYPE fleet_owner_status AS ENUM ('active', 'pending_verification', 'suspended');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pricing_rule_type') THEN
        CREATE TYPE pricing_rule_type AS ENUM ('seasonal', 'event', 'demand_multiplier');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pricing_rule_status') THEN
        CREATE TYPE pricing_rule_status AS ENUM ('active', 'inactive');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
        CREATE TYPE media_type AS ENUM ('image', 'video');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_verification_status') THEN
        CREATE TYPE payment_verification_status AS ENUM ('submitted', 'verified', 'rejected');
    END IF;
END $$;

ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'on_trip';

-- TABLES

-- 1. User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone_number TEXT,
  email TEXT,
  address TEXT,
  license_number TEXT,
  status TEXT DEFAULT 'active',
  last_login TIMESTAMPTZ,
  role user_role NOT NULL DEFAULT 'client',
  loyalty_tier TEXT DEFAULT 'Bronze', -- 'Bronze', 'Silver', 'Gold', 'Platinum'
  referral_credits NUMERIC DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Fleet Owner Settings
CREATE TABLE IF NOT EXISTS fleet_owner_settings (
  id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  company_name TEXT,
  commission_rate NUMERIC DEFAULT 0.15,
  payout_method TEXT,
  payout_details JSONB,
  tax_id TEXT,
  support_email TEXT,
  support_phone TEXT,
  vat_status BOOLEAN DEFAULT FALSE,
  vat_rate NUMERIC DEFAULT 0.16,
  fuel_policy TEXT DEFAULT 'Full to Full',
  late_return_grace_period INTEGER DEFAULT 60, -- in minutes
  late_return_penalty_multiplier NUMERIC DEFAULT 1.5,
  booking_alerts BOOLEAN DEFAULT TRUE,
  fleet_health_alerts BOOLEAN DEFAULT TRUE,
  financial_alerts BOOLEAN DEFAULT TRUE,
  timezone TEXT DEFAULT 'Africa/Nairobi',
  preferred_currency TEXT DEFAULT 'KES',
  logo_url TEXT,
  status fleet_owner_status DEFAULT 'pending_verification',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Cars
CREATE TABLE IF NOT EXISTS vehicle_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  display_name TEXT,
  category TEXT,
  description TEXT,
  primary_image_url TEXT,
  gallery_urls TEXT[] DEFAULT '{}',
  video_url TEXT,
  transmission TEXT,
  fuel_type TEXT,
  seats INTEGER,
  luggage INTEGER,
  features TEXT[] DEFAULT '{}',
  base_daily_rate NUMERIC,
  overtime_rate NUMERIC DEFAULT 0,
  security_deposit NUMERIC DEFAULT 0,
  is_chauffeured_only BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_owner_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  vehicle_model_id UUID REFERENCES vehicle_models(id) ON DELETE SET NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  color TEXT,
  license_plate TEXT UNIQUE NOT NULL,
  category TEXT,
  description TEXT,
  primary_image_url TEXT,
  photos TEXT[] DEFAULT '{}',
  video_url TEXT,
  transmission TEXT,
  fuel_type TEXT,
  seats INTEGER,
  features TEXT[] DEFAULT '{}',
  location_lat NUMERIC,
  location_lon NUMERIC,
  status car_status DEFAULT 'available',
  maintenance_status maintenance_status DEFAULT 'ok',
  last_maintenance_date DATE,
  next_service_date DATE,
  daily_rate NUMERIC NOT NULL,
  overtime_rate NUMERIC DEFAULT 0,
  security_deposit NUMERIC DEFAULT 0,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
  vehicle_model_id UUID REFERENCES vehicle_models(id) ON DELETE SET NULL,
  client_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  fleet_owner_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_amount NUMERIC NOT NULL,
  platform_commission NUMERIC NOT NULL,
  status booking_status DEFAULT 'pending',
  payment_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'KES',
  status transaction_status DEFAULT 'pending',
  transaction_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Pricing Rules
CREATE TABLE IF NOT EXISTS pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  type pricing_rule_type NOT NULL,
  start_date DATE,
  end_date DATE,
  multiplier NUMERIC NOT NULL,
  car_type_filter TEXT,
  status pricing_rule_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  subject TEXT,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'new', -- 'new', 'open', 'resolved'
  urgency TEXT DEFAULT 'low', -- 'low', 'medium', 'high'
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8.1 Broadcasts
CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  target_group TEXT NOT NULL, -- 'all', 'clients', 'fleet_owners'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read broadcasts" ON broadcasts;
CREATE POLICY "Anyone can read broadcasts" ON broadcasts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage broadcasts" ON broadcasts;
CREATE POLICY "Admins can manage broadcasts" ON broadcasts FOR ALL USING (is_admin());

-- 9. Settings
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Hero Content
CREATE TABLE IF NOT EXISTS hero_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID REFERENCES cars(id) ON DELETE SET NULL,
  media_url TEXT NOT NULL,
  media_type media_type NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  overlay_text TEXT,
  deep_link_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Contracts Master
CREATE TABLE IF NOT EXISTS contracts_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Pending Payments
CREATE TABLE IF NOT EXISTS pending_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  client_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  transaction_code TEXT NOT NULL,
  status payment_verification_status DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ
);

-- 13. Coupons
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_value NUMERIC NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
  expiry_date DATE NOT NULL,
  usage_limit INTEGER DEFAULT 100,
  usage_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active', -- 'active', 'expired', 'disabled'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14a. Promotions
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
  discount_value NUMERIC NOT NULL,
  category TEXT DEFAULT 'all', -- 'all', 'suv', 'sedan', 'luxury', etc.
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  banner_text TEXT, -- text shown in the marquee banner
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read active promotions" ON promotions;
CREATE POLICY "Public can read active promotions" ON promotions FOR SELECT USING (is_active = true AND NOW() BETWEEN start_date AND end_date);
DROP POLICY IF EXISTS "Admins can manage promotions" ON promotions;
CREATE POLICY "Admins can manage promotions" ON promotions FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 14b. Contact Messages
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'unread', -- 'unread', 'read', 'replied'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage contact messages" ON contact_messages;
CREATE POLICY "Admins can manage contact messages" ON contact_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Anyone can insert contact messages" ON contact_messages;
CREATE POLICY "Anyone can insert contact messages" ON contact_messages FOR INSERT WITH CHECK (true);

-- 14. Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'published', 'flagged'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Reports
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- 'financial', 'operational', 'user'
  file_url TEXT,
  status TEXT DEFAULT 'ready', -- 'ready', 'generating'
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS POLICIES FOR CARS
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view cars" ON cars;
CREATE POLICY "Public can view cars" ON cars FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage cars" ON cars;
CREATE POLICY "Admins can manage cars" ON cars FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Fleet owners can manage their own cars" ON cars;
CREATE POLICY "Fleet owners can manage their own cars" ON cars FOR ALL USING (auth.uid() = fleet_owner_id);

-- 16. Driver Profiles
CREATE TABLE IF NOT EXISTS driver_profiles (
  id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  license_number TEXT,
  license_expiry DATE,
  license_status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
  id_status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
  status TEXT DEFAULT 'pending_verification', -- 'active', 'suspended', 'pending_verification'
  rating NUMERIC DEFAULT 0,
  total_trips INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 26. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- ===============================================================
-- RLS POLICIES
-- ===============================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_owner_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hero Content Policies (PUBLIC read for active, ADMIN full access)
DROP POLICY IF EXISTS "Public can read active hero content" ON hero_content;
CREATE POLICY "Public can read active hero content" ON hero_content FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage hero content" ON hero_content;
CREATE POLICY "Admins can manage hero content" ON hero_content FOR ALL USING (is_admin());

-- Contracts Master Policies (PUBLIC read for active, ADMIN full access)
DROP POLICY IF EXISTS "Public can read active contracts" ON contracts_master;
CREATE POLICY "Public can read active contracts" ON contracts_master FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage contracts master" ON contracts_master;
CREATE POLICY "Admins can manage contracts master" ON contracts_master FOR ALL USING (is_admin());

-- User Profiles Policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
CREATE POLICY "Admins can view all profiles" ON user_profiles FOR SELECT USING (is_admin() OR auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND 
  (role = (SELECT role FROM user_profiles WHERE id = auth.uid())) AND
  (loyalty_tier = (SELECT loyalty_tier FROM user_profiles WHERE id = auth.uid())) AND
  (referral_credits = (SELECT referral_credits FROM user_profiles WHERE id = auth.uid()))
);
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
CREATE POLICY "Admins can update any profile" ON user_profiles FOR UPDATE USING (is_admin());
DROP POLICY IF EXISTS "Drivers can view client profiles of assigned bookings" ON user_profiles;
CREATE POLICY "Drivers can view client profiles of assigned bookings" ON user_profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.client_id = user_profiles.id
      AND bookings.driver_id = auth.uid()
    )
  );

-- Cars Policies
DROP POLICY IF EXISTS "Anyone can view available cars" ON cars;
CREATE POLICY "Anyone can view available cars" ON cars FOR SELECT USING (status = 'available' OR is_admin() OR fleet_owner_id = auth.uid());
DROP POLICY IF EXISTS "Admins can manage cars" ON cars;
CREATE POLICY "Admins can manage cars" ON cars FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Owners can manage their own cars" ON cars;
CREATE POLICY "Owners can manage their own cars" ON cars FOR ALL USING (fleet_owner_id = auth.uid());
DROP POLICY IF EXISTS "Drivers can view all cars" ON cars;
CREATE POLICY "Drivers can view all cars" ON cars
  FOR SELECT TO authenticated
  USING (true);

-- Bookings Policies
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
CREATE POLICY "Admins can view all bookings" ON bookings FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS "Owners can view their car bookings" ON bookings;
CREATE POLICY "Owners can view their car bookings" ON bookings FOR SELECT USING (fleet_owner_id = auth.uid());
DROP POLICY IF EXISTS "Clients can view their own bookings" ON bookings;
CREATE POLICY "Clients can view their own bookings" ON bookings FOR SELECT USING (client_id = auth.uid());
DROP POLICY IF EXISTS "Drivers can view their assigned bookings" ON bookings;
CREATE POLICY "Drivers can view their assigned bookings" ON bookings
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid());
DROP POLICY IF EXISTS "Admins can update bookings" ON bookings;
CREATE POLICY "Admins can update bookings" ON bookings FOR UPDATE USING (is_admin());

-- Transactions Policies
DROP POLICY IF EXISTS "Admins can view all transactions" ON transactions;
CREATE POLICY "Admins can view all transactions" ON transactions FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
CREATE POLICY "Users can view their own transactions" ON transactions FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins can insert transactions" ON transactions;
CREATE POLICY "Admins can insert transactions" ON transactions
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- Messages Policies
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
CREATE POLICY "Users can view their own messages" ON messages FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Settings Policies
DROP POLICY IF EXISTS "Anyone can view settings" ON settings;
CREATE POLICY "Anyone can view settings" ON settings FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Admins can manage settings" ON settings;
CREATE POLICY "Admins can manage settings" ON settings FOR ALL USING (is_admin());

-- Coupons Policies
DROP POLICY IF EXISTS "Anyone can view active coupons" ON coupons;
CREATE POLICY "Anyone can view active coupons" ON coupons FOR SELECT USING (status = 'active' OR is_admin());
DROP POLICY IF EXISTS "Admins can manage coupons" ON coupons;
CREATE POLICY "Admins can manage coupons" ON coupons FOR ALL USING (is_admin());

-- Reviews Policies
DROP POLICY IF EXISTS "Anyone can view published reviews" ON reviews;
CREATE POLICY "Anyone can view published reviews" ON reviews FOR SELECT USING (status = 'published' OR is_admin() OR user_id = auth.uid());
DROP POLICY IF EXISTS "Users can create reviews" ON reviews;
CREATE POLICY "Users can create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can manage reviews" ON reviews;
CREATE POLICY "Admins can manage reviews" ON reviews FOR ALL USING (is_admin());

-- Reports Policies
DROP POLICY IF EXISTS "Admins can view all reports" ON reports;
CREATE POLICY "Admins can view all reports" ON reports FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS "Admins can manage reports" ON reports;
CREATE POLICY "Admins can manage reports" ON reports FOR ALL USING (is_admin());

-- Driver Profiles Policies
DROP POLICY IF EXISTS "Admins can view all driver profiles" ON driver_profiles;
CREATE POLICY "Admins can view all driver profiles" ON driver_profiles FOR SELECT USING (is_admin() OR auth.uid() = id);
DROP POLICY IF EXISTS "Drivers can update their own profile" ON driver_profiles;
CREATE POLICY "Drivers can update their own profile" ON driver_profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admins can update any driver profile" ON driver_profiles;
CREATE POLICY "Admins can update any driver profile" ON driver_profiles FOR UPDATE USING (is_admin());

-- 17. Incidents
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'accident', 'breakdown', 'theft', 'other'
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
  description TEXT,
  location_text TEXT,
  location_lat NUMERIC,
  location_lon NUMERIC,
  photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view all incidents" ON incidents;
CREATE POLICY "Admins can view all incidents" ON incidents FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS "Users can view their own incidents" ON incidents;
CREATE POLICY "Users can view their own incidents" ON incidents FOR SELECT USING (user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS "Admins can manage incidents" ON incidents;
CREATE POLICY "Admins can manage incidents" ON incidents FOR ALL USING (is_admin());

-- 18. Maintenance
CREATE TABLE IF NOT EXISTS maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
  cost NUMERIC NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  next_due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add next_due_date column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance' AND column_name = 'next_due_date') THEN 
        ALTER TABLE maintenance ADD COLUMN next_due_date DATE; 
    END IF; 
END $$;

ALTER TABLE maintenance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage maintenance" ON maintenance;
CREATE POLICY "Admins can manage maintenance" ON maintenance FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Owners can view their car maintenance" ON maintenance;
CREATE POLICY "Owners can view their car maintenance" ON maintenance FOR SELECT USING (EXISTS (SELECT 1 FROM cars WHERE cars.id = maintenance.car_id AND cars.fleet_owner_id = auth.uid()));

DROP TRIGGER IF EXISTS update_incidents_updated_at ON incidents;
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 19. Client Documents
CREATE TABLE IF NOT EXISTS client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'id', 'license'
  document_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  rejection_reason TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage client documents" ON client_documents;
CREATE POLICY "Admins can manage client documents" ON client_documents FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Clients can view and upload their own documents" ON client_documents;
CREATE POLICY "Clients can view and upload their own documents" ON client_documents FOR ALL USING (client_id = auth.uid());

-- 20. Damage Reports
CREATE TABLE IF NOT EXISTS damage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
  fleet_owner_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  photos TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending', -- 'pending', 'resolved'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. E-Contracts
CREATE TABLE IF NOT EXISTS e_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  pdf_url TEXT NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE e_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners can view their car contracts" ON e_contracts;
CREATE POLICY "Owners can view their car contracts" ON e_contracts FOR SELECT USING (EXISTS (SELECT 1 FROM bookings WHERE bookings.id = e_contracts.booking_id AND bookings.fleet_owner_id = auth.uid()));
DROP POLICY IF EXISTS "Admins can manage contracts" ON e_contracts;
CREATE POLICY "Admins can manage contracts" ON e_contracts FOR ALL USING (is_admin());

ALTER TABLE damage_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Fleet owners can manage their damage reports" ON damage_reports;
CREATE POLICY "Fleet owners can manage their damage reports" ON damage_reports FOR ALL USING (fleet_owner_id = auth.uid());
DROP POLICY IF EXISTS "Admins can manage damage reports" ON damage_reports;
CREATE POLICY "Admins can manage damage reports" ON damage_reports FOR ALL USING (is_admin());

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_fleet_owner_settings_updated_at ON fleet_owner_settings;
CREATE TRIGGER update_fleet_owner_settings_updated_at BEFORE UPDATE ON fleet_owner_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_pricing_rules_updated_at ON pricing_rules;
CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON pricing_rules FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_hero_content_updated_at ON hero_content;
CREATE TRIGGER update_hero_content_updated_at BEFORE UPDATE ON hero_content FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_contracts_master_updated_at ON contracts_master;
CREATE TRIGGER update_contracts_master_updated_at BEFORE UPDATE ON contracts_master FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_driver_profiles_updated_at ON driver_profiles;
CREATE TRIGGER update_driver_profiles_updated_at BEFORE UPDATE ON driver_profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 22. Client Preferences
CREATE TABLE IF NOT EXISTS client_preferences (
  id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  preferred_pickup_location TEXT,
  preferred_dropoff_location TEXT,
  default_payment_method TEXT,
  always_include_chauffeur BOOLEAN DEFAULT FALSE,
  booking_notifications BOOLEAN DEFAULT TRUE,
  marketing_notifications BOOLEAN DEFAULT FALSE,
  security_notifications BOOLEAN DEFAULT TRUE,
  preferred_currency TEXT DEFAULT 'KES',
  preferred_language TEXT DEFAULT 'en',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own preferences" ON client_preferences;
CREATE POLICY "Users can manage their own preferences" ON client_preferences FOR ALL USING (auth.uid() = id);

-- 23. Wishlist (Saved Cars)
CREATE TABLE IF NOT EXISTS wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, car_id)
);

ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own wishlist" ON wishlist;
CREATE POLICY "Users can manage their own wishlist" ON wishlist FOR ALL USING (auth.uid() = client_id);

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_client_preferences_updated_at ON client_preferences;
CREATE TRIGGER update_client_preferences_updated_at BEFORE UPDATE ON client_preferences FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 24. Extension Requests
CREATE TABLE IF NOT EXISTS extension_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  client_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  new_end_date DATE NOT NULL,
  estimated_cost NUMERIC,
  reason TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE extension_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own extension requests" ON extension_requests;
CREATE POLICY "Users can view their own extension requests" ON extension_requests FOR SELECT USING (auth.uid() = client_id);
DROP POLICY IF EXISTS "Users can create extension requests" ON extension_requests;
CREATE POLICY "Users can create extension requests" ON extension_requests FOR INSERT WITH CHECK (auth.uid() = client_id);
DROP POLICY IF EXISTS "Admins can manage extension requests" ON extension_requests;
CREATE POLICY "Admins can manage extension requests" ON extension_requests FOR ALL USING (is_admin());

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_extension_requests_updated_at ON extension_requests;
CREATE TRIGGER update_extension_requests_updated_at BEFORE UPDATE ON extension_requests FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 25. Exclusive Offers for Loyalty Program
CREATE TABLE IF NOT EXISTS exclusive_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  discount_percentage NUMERIC,
  min_tier TEXT DEFAULT 'Bronze', -- 'Bronze', 'Silver', 'Gold', 'Platinum'
  expiry_date TIMESTAMPTZ,
  image_url TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'expired', 'disabled'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exclusive_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read active exclusive offers" ON exclusive_offers;
CREATE POLICY "Anyone can read active exclusive offers" ON exclusive_offers FOR SELECT USING (status = 'active');

-- 21. Payouts
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'processed', 'failed'
  reference_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners can view their payouts" ON payouts;
CREATE POLICY "Owners can view their payouts" ON payouts FOR SELECT USING (auth.uid() = fleet_owner_id);
DROP POLICY IF EXISTS "Admins can manage payouts" ON payouts;
CREATE POLICY "Admins can manage payouts" ON payouts FOR ALL USING (is_admin());

-- 22. Missing Policies for Expenses
DROP POLICY IF EXISTS "Users can manage their own expenses" ON expenses;
CREATE POLICY "Users can manage their own expenses" ON expenses FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can manage all expenses" ON expenses;
CREATE POLICY "Admins can manage all expenses" ON expenses FOR ALL USING (is_admin());

-- 23. Missing Policies for Fleet Owner Settings
DROP POLICY IF EXISTS "Fleet owners can manage their own settings" ON fleet_owner_settings;
CREATE POLICY "Fleet owners can manage their own settings" ON fleet_owner_settings FOR ALL USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admins can manage all fleet owner settings" ON fleet_owner_settings;
CREATE POLICY "Admins can manage all fleet owner settings" ON fleet_owner_settings FOR ALL USING (is_admin());

-- 24. Missing Policies for Maintenance
DROP POLICY IF EXISTS "Owners can manage their car maintenance" ON maintenance;
CREATE POLICY "Owners can manage their car maintenance" ON maintenance FOR ALL USING (EXISTS (SELECT 1 FROM cars WHERE cars.id = maintenance.car_id AND cars.fleet_owner_id = auth.uid()));

-- 25. Missing Policies for Bookings
DROP POLICY IF EXISTS "Owners can update their car bookings" ON bookings;
CREATE POLICY "Owners can update their car bookings" ON bookings FOR UPDATE USING (fleet_owner_id = auth.uid());

-- Allow guest (anonymous) and authenticated users to create bookings
DROP POLICY IF EXISTS "Anyone can create bookings" ON bookings;
CREATE POLICY "Anyone can create bookings" ON bookings FOR INSERT WITH CHECK (true);

-- Allow anyone to read a booking by ID (for confirmation page - guest bookings)
DROP POLICY IF EXISTS "Anyone can view their booking by id" ON bookings;
CREATE POLICY "Anyone can view their booking by id" ON bookings FOR SELECT USING (
  client_id = auth.uid() OR client_id IS NULL OR is_admin() OR fleet_owner_id = auth.uid()
);

-- Allow guest (anonymous) users to insert pending payments
DROP POLICY IF EXISTS "Anyone can create pending payments" ON pending_payments;
CREATE POLICY "Anyone can create pending payments" ON pending_payments FOR INSERT WITH CHECK (true);

-- Allow anonymous uploads to public_assets for guest booking documents
DROP POLICY IF EXISTS "Anyone can upload booking documents" ON storage.objects;
CREATE POLICY "Anyone can upload booking documents" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'public_assets' AND (storage.foldername(name))[1] = 'booking-docs'
);

-- 26. Missing Policies for Messages
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
CREATE POLICY "Users can update their own messages" ON messages FOR UPDATE USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- SEED DATA
INSERT INTO coupons (code, discount_value, discount_type, expiry_date, usage_limit, status)
VALUES 
('WELCOME20', 20, 'percentage', '2027-12-31', 1000, 'active'),
('DRIVE500', 500, 'fixed', '2027-12-31', 500, 'active'),
('WEEKEND15', 15, 'percentage', '2027-12-31', 200, 'active')
ON CONFLICT (code) DO NOTHING;

INSERT INTO exclusive_offers (title, description, discount_percentage, min_tier, status, image_url)
VALUES 
('Early Access: New Luxury Fleet', 'Be the first to drive our new 2026 Range Rover models.', 0, 'Gold', 'active', 'https://picsum.photos/seed/luxury/800/400'),
('Weekend Flash Sale', 'Get 25% off on all SUV rentals this weekend only.', 25, 'Bronze', 'active', 'https://picsum.photos/seed/suv/800/400'),
('Personal Concierge Service', 'Complimentary personal concierge for all your travel needs.', 0, 'Platinum', 'active', 'https://picsum.photos/seed/concierge/800/400')
ON CONFLICT DO NOTHING;

-- ===============================================================
-- Storage Configuration
-- ===============================================================

-- Create the public_assets bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('public_assets', 'public_assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for public_assets
-- 1. Allow public read access
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'public_assets');

-- 2. Allow authenticated users to upload
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'public_assets' AND auth.role() = 'authenticated'
);

-- 3. Allow admins to delete
DROP POLICY IF EXISTS "Admins can delete" ON storage.objects;
CREATE POLICY "Admins can delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'public_assets' AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
);

-- ===============================================================
-- Schema Extensions: Outsourced Cars, Booking Fields, Notifications
-- ===============================================================

-- Outsourced car columns on cars table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cars' AND column_name = 'is_outsourced') THEN
    ALTER TABLE cars ADD COLUMN is_outsourced BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cars' AND column_name = 'outsource_owner_name') THEN
    ALTER TABLE cars ADD COLUMN outsource_owner_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cars' AND column_name = 'outsource_owner_phone') THEN
    ALTER TABLE cars ADD COLUMN outsource_owner_phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cars' AND column_name = 'outsource_owner_email') THEN
    ALTER TABLE cars ADD COLUMN outsource_owner_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cars' AND column_name = 'outsource_commission_rate') THEN
    ALTER TABLE cars ADD COLUMN outsource_commission_rate NUMERIC DEFAULT 15;
  END IF;
END $$;

-- Booking columns for payment method, locations, chauffeur, payment_status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'payment_status') THEN
    ALTER TABLE bookings ADD COLUMN payment_status TEXT DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'payment_method') THEN
    ALTER TABLE bookings ADD COLUMN payment_method TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'pickup_location') THEN
    ALTER TABLE bookings ADD COLUMN pickup_location TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'dropoff_location') THEN
    ALTER TABLE bookings ADD COLUMN dropoff_location TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'needs_chauffeur') THEN
    ALTER TABLE bookings ADD COLUMN needs_chauffeur BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'driver_id') THEN
    ALTER TABLE bookings ADD COLUMN driver_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'metadata') THEN
    ALTER TABLE bookings ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- Notification Queue table for external SMS/email delivery
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- 'sms' or 'email'
  template TEXT,
  data JSONB,
  recipient TEXT, -- phone number or email address
  content TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'queued', 'sent', 'failed'
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage notification queue" ON notification_queue;
CREATE POLICY "Admins can manage notification queue" ON notification_queue FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "System can insert notifications" ON notification_queue;
CREATE POLICY "System can insert notifications" ON notification_queue FOR INSERT WITH CHECK (true);

-- Secure documents bucket for sensitive ID/license uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('secure_documents', 'secure_documents', false)
ON CONFLICT (id) DO NOTHING;

-- Only authenticated users can upload to secure_documents
DROP POLICY IF EXISTS "Authenticated users can upload secure docs" ON storage.objects;
CREATE POLICY "Authenticated users can upload secure docs" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'secure_documents' AND auth.role() = 'authenticated'
);

-- Users can read their own secure documents (path starts with their user ID)
DROP POLICY IF EXISTS "Users can read their own secure docs" ON storage.objects;
CREATE POLICY "Users can read their own secure docs" ON storage.objects FOR SELECT USING (
  bucket_id = 'secure_documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
  )
);

-- Admins can read all secure documents
DROP POLICY IF EXISTS "Admins can manage secure docs" ON storage.objects;
CREATE POLICY "Admins can manage secure docs" ON storage.objects FOR ALL USING (
  bucket_id = 'secure_documents' AND (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
);

-- Allow notifications to be inserted by the system (for guest bookings too)
DROP POLICY IF EXISTS "Anyone can insert notifications" ON notifications;
CREATE POLICY "Anyone can insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- M-Pesa integration: add metadata column to pending_payments for STK Push tracking
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pending_payments' AND column_name = 'metadata') THEN
    ALTER TABLE pending_payments ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- Allow admins and system to read/update pending_payments
DROP POLICY IF EXISTS "Admins can manage pending payments" ON pending_payments;
CREATE POLICY "Admins can manage pending payments" ON pending_payments FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "System can update pending payments" ON pending_payments;
CREATE POLICY "System can update pending payments" ON pending_payments FOR UPDATE WITH CHECK (true);

-- ===============================================================
-- Booking Inspections (pre-handover / post-return)
-- ===============================================================

CREATE TABLE IF NOT EXISTS booking_inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pre_handover', 'post_return')),
  fuel_level TEXT,
  mileage INTEGER,
  location TEXT,
  scratches_notes TEXT,
  photos_exterior JSONB DEFAULT '[]'::jsonb,
  photos_interior JSONB DEFAULT '[]'::jsonb,
  photo_fuel_mileage TEXT,
  conducted_by UUID REFERENCES auth.users(id),
  gps_lat NUMERIC,
  gps_lon NUMERIC,
  client_signature_url TEXT,
  checklist_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE booking_inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers can view inspections for their assigned bookings" ON booking_inspections;
CREATE POLICY "Drivers can view inspections for their assigned bookings" ON booking_inspections
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_inspections.booking_id AND bookings.driver_id = auth.uid())
    OR is_admin()
    OR EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_inspections.booking_id AND bookings.fleet_owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Drivers can insert inspections for their assigned bookings" ON booking_inspections;
CREATE POLICY "Drivers can insert inspections for their assigned bookings" ON booking_inspections
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_id AND bookings.driver_id = auth.uid())
    OR is_admin()
    OR EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_id AND bookings.fleet_owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Drivers cannot update inspections" ON booking_inspections;
CREATE POLICY "Drivers cannot update inspections" ON booking_inspections
  FOR UPDATE TO authenticated
  USING (is_admin());

INSERT INTO storage.buckets (id, name, public)
VALUES ('booking_inspections', 'booking_inspections', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access for booking_inspections" ON storage.objects;
CREATE POLICY "Public Access for booking_inspections"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'booking_inspections');

DROP POLICY IF EXISTS "Authenticated users can upload to booking_inspections" ON storage.objects;
CREATE POLICY "Authenticated users can upload to booking_inspections"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'booking_inspections');

DROP POLICY IF EXISTS "Admins can delete booking_inspections objects" ON storage.objects;
CREATE POLICY "Admins can delete booking_inspections objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'booking_inspections'
    AND (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
  );
