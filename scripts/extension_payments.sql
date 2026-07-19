-- Extension payments — link payment_requests to booking_extensions
-- and add helper columns for cash / manual settlement.

alter table public.payment_requests
  add column if not exists booking_extension_id uuid null references public.booking_extensions(id) on delete set null;

create index if not exists idx_payment_requests_extension_id
  on public.payment_requests(booking_extension_id)
  where booking_extension_id is not null;

-- Track how an extension got settled (stk / cash / waived).
alter table public.booking_extensions
  add column if not exists payment_method text null,
  add column if not exists paid_at timestamptz null,
  add column if not exists paid_by uuid null;
