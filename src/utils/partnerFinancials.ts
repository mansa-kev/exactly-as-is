export interface PayoutSlice {
  pending: number;
  paid: number;
  countPending: number;
  countPaid: number;
}

export interface PayoutBreakdown {
  supplierOutsourced: PayoutSlice;
  supplierFleet: PayoutSlice;
  broker: PayoutSlice;
}

export interface BrokerReconciliationRow {
  brokerId: string;
  brokerName: string;
  referralCount: number;
  grossReferred: number;
  commissionOwed: number;
  commissionPaid: number;
  balance: number;
}

export interface BookingReconciliationRow {
  bookingId: string;
  bookingRef: string;
  bookingDate: string;
  grossAmount: number;
  platformCommission: number;
  supplierPayout: number | null;
  supplierType: 'outsourced' | 'fleet' | null;
  supplierName: string | null;
  supplierStatus: 'pending' | 'paid' | 'cancelled' | null;
  brokerPayout: number | null;
  brokerName: string | null;
  brokerStatus: 'pending' | 'paid' | 'cancelled' | null;
}

const emptySlice = (): PayoutSlice => ({
  pending: 0,
  paid: 0,
  countPending: 0,
  countPaid: 0,
});

export function createEmptyPayoutBreakdown(): PayoutBreakdown {
  return {
    supplierOutsourced: emptySlice(),
    supplierFleet: emptySlice(),
    broker: emptySlice(),
  };
}

function addToSlice(slice: PayoutSlice, amount: number, status: string) {
  const value = Number(amount) || 0;
  if (status === 'paid') {
    slice.paid += value;
    slice.countPaid += 1;
  } else if (status === 'pending') {
    slice.pending += value;
    slice.countPending += 1;
  }
}

export function buildPayoutBreakdown(
  settlements: any[],
  outsourcedCarIds: Set<string>
): PayoutBreakdown {
  const breakdown = createEmptyPayoutBreakdown();

  settlements.forEach((s) => {
    const amount = Number(s.amount) || 0;
    const status = s.status || 'pending';

    if (s.type === 'broker') {
      addToSlice(breakdown.broker, amount, status);
      return;
    }

    if (s.type === 'supplier') {
      const isOutsourced =
        s.booking?.cars?.is_outsourced === true ||
        outsourcedCarIds.has(s.target_id) ||
        outsourcedCarIds.has(s.booking?.car_id);
      const slice = isOutsourced ? breakdown.supplierOutsourced : breakdown.supplierFleet;
      addToSlice(slice, amount, status);
    }
  });

  return breakdown;
}

export function buildBrokerReconciliation(
  settlements: any[],
  brokers: { id: string; name: string }[],
  bookingsById: Map<string, { total_amount: number }>
): BrokerReconciliationRow[] {
  const byBroker = new Map<string, BrokerReconciliationRow>();

  brokers.forEach((b) => {
    byBroker.set(b.id, {
      brokerId: b.id,
      brokerName: b.name,
      referralCount: 0,
      grossReferred: 0,
      commissionOwed: 0,
      commissionPaid: 0,
      balance: 0,
    });
  });

  const countedBookings = new Set<string>();

  settlements
    .filter((s) => s.type === 'broker' && s.booking_id)
    .forEach((s) => {
      const row = byBroker.get(s.target_id);
      if (!row) return;

      const amount = Number(s.amount) || 0;
      if (!countedBookings.has(s.booking_id)) {
        countedBookings.add(s.booking_id);
        row.referralCount += 1;
        const booking = bookingsById.get(s.booking_id);
        if (booking) row.grossReferred += Number(booking.total_amount) || 0;
      }

      if (s.status === 'paid') row.commissionPaid += amount;
      else if (s.status === 'pending') row.commissionOwed += amount;
    });

  return Array.from(byBroker.values())
    .map((row) => ({
      ...row,
      balance: row.commissionOwed,
    }))
    .filter((row) => row.referralCount > 0 || row.commissionPaid > 0 || row.commissionOwed > 0)
    .sort((a, b) => b.balance - a.balance || b.commissionPaid - a.commissionPaid);
}

export function buildBookingReconciliation(
  settlements: any[],
  brokers: { id: string; name: string }[]
): BookingReconciliationRow[] {
  const brokerById = new Map(brokers.map((b) => [b.id, b.name]));
  const byBooking = new Map<string, BookingReconciliationRow>();

  settlements.forEach((s) => {
    if (!s.booking_id) return;

    if (!byBooking.has(s.booking_id)) {
      const booking = s.booking || {};
      const car = booking.cars || null;
      byBooking.set(s.booking_id, {
        bookingId: s.booking_id,
        bookingRef: String(s.booking_id).slice(0, 8).toUpperCase(),
        bookingDate: booking.created_at || s.created_at,
        grossAmount: Number(booking.total_amount) || 0,
        platformCommission: Number(booking.platform_commission) || 0,
        supplierPayout: null,
        supplierType: null,
        supplierName: null,
        supplierStatus: null,
        brokerPayout: null,
        brokerName: null,
        brokerStatus: null,
      });
    }

    const row = byBooking.get(s.booking_id)!;
    const amount = Number(s.amount) || 0;

    if (s.type === 'supplier') {
      const car = s.booking?.cars;
      row.supplierPayout = amount;
      row.supplierStatus = s.status;
      row.supplierType = car?.is_outsourced ? 'outsourced' : 'fleet';
      row.supplierName = car?.is_outsourced
        ? car.outsource_owner_name || 'Outsourced Partner'
        : 'Fleet Owner';
    }

    if (s.type === 'broker') {
      row.brokerPayout = amount;
      row.brokerStatus = s.status;
      row.brokerName = brokerById.get(s.target_id) || 'Broker';
    }
  });

  return Array.from(byBooking.values()).sort(
    (a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime()
  );
}

export function buildMonthlyPartnerChart(
  confirmedBookings: { created_at: string; total_amount: number }[],
  settlements: any[],
  outsourcedCarIds: Set<string>
) {
  const monthly: Record<string, {
    name: string;
    revenue: number;
    payouts: number;
    supplierOutsourced: number;
    supplierFleet: number;
    brokerPayouts: number;
  }> = {};

  const monthKey = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

  confirmedBookings.forEach((booking) => {
    const key = monthKey(booking.created_at);
    if (!monthly[key]) {
      monthly[key] = {
        name: key,
        revenue: 0,
        payouts: 0,
        supplierOutsourced: 0,
        supplierFleet: 0,
        brokerPayouts: 0,
      };
    }
    monthly[key].revenue += Number(booking.total_amount) || 0;
  });

  settlements
    .filter((s) => s.status === 'paid')
    .forEach((s) => {
      const dt = s.settled_at || s.created_at;
      const key = monthKey(dt);
      if (!monthly[key]) {
        monthly[key] = {
          name: key,
          revenue: 0,
          payouts: 0,
          supplierOutsourced: 0,
          supplierFleet: 0,
          brokerPayouts: 0,
        };
      }
      const amount = Number(s.amount) || 0;
      monthly[key].payouts += amount;

      if (s.type === 'broker') {
        monthly[key].brokerPayouts += amount;
      } else if (s.type === 'supplier') {
        const isOutsourced =
          s.booking?.cars?.is_outsourced === true ||
          outsourcedCarIds.has(s.target_id) ||
          outsourcedCarIds.has(s.booking?.car_id);
        if (isOutsourced) monthly[key].supplierOutsourced += amount;
        else monthly[key].supplierFleet += amount;
      }
    });

  return Object.values(monthly).reverse();
}
