-- Add tracking column for return reminders
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS return_reminder_sent BOOLEAN DEFAULT false;

-- Create an index to make the cron job query faster
CREATE INDEX IF NOT EXISTS idx_bookings_return_reminder 
ON public.bookings (status, return_reminder_sent, end_date);
