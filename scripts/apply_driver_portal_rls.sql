-- Apply driver portal RLS policies (safe to re-run in Supabase SQL Editor)
-- Required for drivers.linkedupcarsrentals.com task list and client contact details.

DROP POLICY IF EXISTS "Drivers can view their assigned bookings" ON bookings;
CREATE POLICY "Drivers can view their assigned bookings" ON bookings
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

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

DROP POLICY IF EXISTS "Drivers can view all cars" ON cars;
CREATE POLICY "Drivers can view all cars" ON cars
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert transactions" ON transactions;
CREATE POLICY "Admins can insert transactions" ON transactions
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());
