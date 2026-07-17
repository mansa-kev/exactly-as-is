import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck,
  Users,
  Building2,
  ArrowRight,
  Search,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type {
  BookingReconciliationRow,
  BrokerReconciliationRow,
  PayoutBreakdown,
} from '../../utils/partnerFinancials';

interface AdminPartnerLedgerProps {
  payoutBreakdown: PayoutBreakdown;
  brokerReconciliation: BrokerReconciliationRow[];
  bookingReconciliation: BookingReconciliationRow[];
  chartData: Array<{
    name: string;
    revenue: number;
    payouts: number;
    supplierOutsourced: number;
    supplierFleet: number;
    brokerPayouts: number;
  }>;
  totalPlatformCommission: number;
}

function SliceCard({
  title,
  icon: Icon,
  slice,
  accent,
}: {
  title: string;
  icon: React.ElementType;
  slice: { pending: number; paid: number; countPending: number; countPaid: number };
  accent: string;
}) {
  return (
    <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
      <div className={`p-2.5 ${accent} rounded-xl w-fit mb-3`}>
        <Icon size={20} />
      </div>
      <h3 className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-2">{title}</h3>
      <div className="space-y-1">
        <p className="text-lg font-black text-foreground">KSh {slice.paid.toLocaleString()} <span className="text-[10px] font-bold text-muted-foreground">settled</span></p>
        <p className="text-sm font-bold text-amber-500">KSh {slice.pending.toLocaleString()} pending</p>
        <p className="text-[10px] text-muted-foreground">{slice.countPaid} paid · {slice.countPending} awaiting</p>
      </div>
    </div>
  );
}

export function AdminPartnerLedger({
  payoutBreakdown,
  brokerReconciliation,
  bookingReconciliation,
  chartData,
  totalPlatformCommission,
}: AdminPartnerLedgerProps) {
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'outsourced' | 'fleet' | 'broker'>('all');
  const [search, setSearch] = useState('');

  const filteredBookings = bookingReconciliation.filter((row) => {
    if (ledgerFilter === 'outsourced' && row.supplierType !== 'outsourced') return false;
    if (ledgerFilter === 'fleet' && row.supplierType !== 'fleet') return false;
    if (ledgerFilter === 'broker' && !row.brokerPayout) return false;

    if (!search) return true;
    const q = search.toLowerCase();
    return (
      row.bookingRef.toLowerCase().includes(q) ||
      (row.supplierName || '').toLowerCase().includes(q) ||
      (row.brokerName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Partner Payout Ledger</h3>
          <p className="text-sm text-muted-foreground">
            Separated supplier (outsourced vs fleet) and broker commission obligations.
          </p>
        </div>
        <Link
          to="/admin/outsourced"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary hover:text-white transition-colors"
        >
          Manage settlements <ArrowRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SliceCard
          title="Outsourced Suppliers"
          icon={Truck}
          slice={payoutBreakdown.supplierOutsourced}
          accent="bg-blue-500/10 text-blue-500"
        />
        <SliceCard
          title="Fleet Owner Payouts"
          icon={Building2}
          slice={payoutBreakdown.supplierFleet}
          accent="bg-emerald-500/10 text-emerald-500"
        />
        <SliceCard
          title="Broker Commissions"
          icon={Users}
          slice={payoutBreakdown.broker}
          accent="bg-purple-500/10 text-purple-500"
        />
        <div className="bg-gradient-to-br from-primary/10 to-transparent p-5 rounded-2xl border border-primary/20 shadow-sm">
          <h3 className="text-primary text-[10px] font-black uppercase tracking-wider mb-2">Platform Commission</h3>
          <p className="text-2xl font-black text-foreground">KSh {totalPlatformCommission.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Recorded on paid bookings</p>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h4 className="font-bold text-base mb-1">Settled Payouts by Channel</h4>
          <p className="text-xs text-muted-foreground mb-4">Monthly breakdown of paid partner obligations</p>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                    borderRadius: '12px',
                  }}
                />
                <Legend iconType="circle" iconSize={8} />
                <Bar dataKey="supplierOutsourced" name="Outsourced" stackId="payouts" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="supplierFleet" name="Fleet" stackId="payouts" fill="#10b981" />
                <Bar dataKey="brokerPayouts" name="Broker" stackId="payouts" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border">
          <h4 className="font-bold text-base">Broker Reconciliation</h4>
          <p className="text-xs text-muted-foreground">Referral volume and commission balance per registered broker</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Broker</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Referrals</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gross Referred</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Paid</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Balance Owed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {brokerReconciliation.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No broker referral settlements recorded yet.
                  </td>
                </tr>
              ) : (
                brokerReconciliation.map((row) => (
                  <tr key={row.brokerId} className="hover:bg-muted/15">
                    <td className="px-5 py-4 text-sm font-bold">{row.brokerName}</td>
                    <td className="px-5 py-4 text-sm">{row.referralCount}</td>
                    <td className="px-5 py-4 text-sm">KSh {row.grossReferred.toLocaleString()}</td>
                    <td className="px-5 py-4 text-sm text-green-500 font-bold">KSh {row.commissionPaid.toLocaleString()}</td>
                    <td className="px-5 py-4 text-sm text-amber-500 font-bold">KSh {row.balance.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-base">Booking Reconciliation</h4>
            <p className="text-xs text-muted-foreground">Per-booking split across platform, supplier, and broker</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search booking or partner..."
                className="pl-9 pr-3 py-2 bg-muted border border-border rounded-xl text-sm w-full sm:w-56"
              />
            </div>
            <div className="flex gap-1 p-1 bg-muted rounded-xl">
              {(['all', 'outsourced', 'fleet', 'broker'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setLedgerFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase ${
                    ledgerFilter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Booking</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gross</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Platform</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Supplier</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Broker</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No reconciled bookings match your filters.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((row) => (
                  <tr key={row.bookingId} className="hover:bg-muted/15">
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-bold">#{row.bookingRef}</span>
                      <p className="text-[10px] text-muted-foreground">{new Date(row.bookingDate).toLocaleDateString()}</p>
                    </td>
                    <td className="px-5 py-4 text-sm font-bold">KSh {row.grossAmount.toLocaleString()}</td>
                    <td className="px-5 py-4 text-sm text-primary font-semibold">KSh {row.platformCommission.toLocaleString()}</td>
                    <td className="px-5 py-4">
                      {row.supplierPayout != null ? (
                        <div>
                          <p className="text-sm font-semibold">KSh {row.supplierPayout.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {row.supplierType} · {row.supplierName}
                            {row.supplierStatus === 'pending' && <span className="text-amber-500"> · pending</span>}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {row.brokerPayout != null ? (
                        <div>
                          <p className="text-sm font-semibold">KSh {row.brokerPayout.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {row.brokerName}
                            {row.brokerStatus === 'pending' && <span className="text-amber-500"> · pending</span>}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
