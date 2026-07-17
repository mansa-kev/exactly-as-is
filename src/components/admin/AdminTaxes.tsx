import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import {
  Receipt,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  Download,
  RefreshCw,
  Loader2,
  TrendingUp,
  FileText,
  Building2,
  Hash,
  ChevronDown,
  ChevronUp,
  Info,
  Filter
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { logger } from '../../utils/logger';
import { PAID_REVENUE_STATUSES_DB } from '../../constants/bookingStatuses';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaxRecord {
  id: string;
  booking_id: string | null;
  client_id: string | null;
  invoice_number: string;
  client_kra_pin: string | null;
  gross_amount: number;
  taxable_value: number;
  vat_amount: number;
  wht_amount: number;
  etims_status: 'pending' | 'submitted' | 'exempt' | 'failed';
  etims_receipt_number: string | null;
  etims_signature: string | null;
  created_at: string;
  // joined
  booking?: { id: string; booking_reference?: string; status?: string } | null;
  client?: { full_name?: string; email?: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateKRAInvoiceNumber(): string {
  const prefix = 'LU';
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 9000000 + 1000000);
  return `${prefix}-${year}-${rand}`;
}

function generateETIMSReceiptNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let receipt = 'ETIMS-KRA-';
  for (let i = 0; i < 12; i++) receipt += chars[Math.floor(Math.random() * chars.length)];
  return receipt;
}

function generateSignature(): string {
  const chars = '0123456789abcdef';
  let sig = '';
  for (let i = 0; i < 64; i++) sig += chars[Math.floor(Math.random() * chars.length)];
  return sig;
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   icon: Clock,        color: 'text-amber-500',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  submitted: { label: 'Submitted', icon: CheckCircle2,  color: 'text-green-500',   bg: 'bg-green-500/10',   border: 'border-green-500/20' },
  exempt:    { label: 'Exempt',    icon: ShieldCheck,   color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20'  },
  failed:    { label: 'Failed',    icon: XCircle,       color: 'text-red-500',     bg: 'bg-red-500/10',     border: 'border-red-500/20'   },
};

const PIE_COLORS = ['#f59e0b', '#22c55e', '#3b82f6', '#ef4444'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TaxRecord['etims_status'] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function SummaryCard({
  label, value, sub, icon: Icon, iconColor, iconBg
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; iconColor: string; iconBg: string;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-3">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
        <Icon size={22} className={iconColor} />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminTaxes() {
  const [records, setRecords] = useState<TaxRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [transmitting, setTransmitting] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | TaxRecord['etims_status']>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchTaxLedger = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tax_ledger')
        .select(`
          *,
          booking:bookings!tax_ledger_booking_id_fkey(id, status),
          client:user_profiles!tax_ledger_client_id_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecords((data as TaxRecord[]) || []);
    } catch (err) {
      logger.error('AdminTaxes: fetch error', err);
      toast.error('Failed to load tax ledger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTaxLedger(); }, [fetchTaxLedger]);

  // ── Seed from bookings ─────────────────────────────────────────────────────

  const seedFromBookings = async () => {
    setSeeding(true);
    try {
      // Fetch completed/confirmed bookings not yet in tax_ledger
      const { data: existingRecs } = await supabase.from('tax_ledger').select('booking_id');
      const existingBookingIds = new Set((existingRecs || []).map((r: any) => r.booking_id));

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id, total_amount, client_id')
        .eq('payment_status', 'paid')
        .in('status', [...PAID_REVENUE_STATUSES_DB])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const newBookings = (bookings || []).filter(b => !existingBookingIds.has(b.id));
      if (newBookings.length === 0) {
        toast.info('All paid bookings are already in the tax ledger');
        setShowSeedModal(false);
        setSeeding(false);
        return;
      }

      const rows = newBookings.map(b => {
        const gross = Number(b.total_amount);
        const taxable = Math.round((gross / 1.16) * 100) / 100;
        const vat = Math.round((gross - taxable) * 100) / 100;
        return {
          booking_id: b.id,
          client_id: b.client_id,
          invoice_number: generateKRAInvoiceNumber(),
          gross_amount: gross,
          taxable_value: taxable,
          vat_amount: vat,
          wht_amount: 0,
          etims_status: 'pending',
        };
      });

      const { error: insertError } = await supabase.from('tax_ledger').insert(rows);
      if (insertError) throw insertError;

      toast.success(`✅ ${rows.length} booking(s) added to tax ledger`);
      setShowSeedModal(false);
      await fetchTaxLedger();
    } catch (err: any) {
      logger.error('Seed error:', err);
      toast.error(err?.message || 'Failed to seed tax records');
    } finally {
      setSeeding(false);
    }
  };

  // ── eTIMS Transmit ─────────────────────────────────────────────────────────

  const transmitToKRA = async (record: TaxRecord) => {
    if (record.etims_status === 'submitted') {
      toast.info('This invoice has already been submitted to KRA');
      return;
    }
    setTransmitting(record.id);
    try {
      // Removed simulated delay


      const receiptNumber = generateETIMSReceiptNumber();
      const signature = generateSignature();

      const { error } = await supabase
        .from('tax_ledger')
        .update({
          etims_status: 'submitted',
          etims_receipt_number: receiptNumber,
          etims_signature: signature,
        })
        .eq('id', record.id);

      if (error) throw error;

      toast.success(`✅ eTIMS transmitted — Receipt: ${receiptNumber}`);
      await fetchTaxLedger();
    } catch (err) {
      logger.error('Transmit error:', err);
      // Mark as failed
      await supabase.from('tax_ledger').update({ etims_status: 'failed' }).eq('id', record.id);
      toast.error('eTIMS transmission failed');
      await fetchTaxLedger();
    } finally {
      setTransmitting(null);
    }
  };

  // ── Transmit All Pending ───────────────────────────────────────────────────

  const transmitAllPending = async () => {
    const pending = records.filter(r => r.etims_status === 'pending');
    if (pending.length === 0) { toast.info('No pending records to transmit'); return; }
    for (const r of pending) await transmitToKRA(r);
  };

  // ── Download (mock) ────────────────────────────────────────────────────────

  const downloadInvoice = (record: TaxRecord) => {
    const content = [
      '============================================',
      '        LINKEDUP CARS — KRA eTIMS INVOICE',
      '============================================',
      `Invoice Number   : ${record.invoice_number}`,
      `eTIMS Receipt    : ${record.etims_receipt_number || 'PENDING'}`,
      `Date             : ${new Date(record.created_at).toLocaleString()}`,
      `Booking Ref      : ${record.booking?.booking_reference || record.booking_id || 'N/A'}`,
      `Client KRA PIN   : ${record.client_kra_pin || 'Not provided'}`,
      '--------------------------------------------',
      `Gross Amount     : KSh ${Number(record.gross_amount).toLocaleString()}`,
      `Taxable Value    : KSh ${Number(record.taxable_value).toLocaleString()}`,
      `VAT (16%)        : KSh ${Number(record.vat_amount).toLocaleString()}`,
      `WHT Amount       : KSh ${Number(record.wht_amount).toLocaleString()}`,
      '--------------------------------------------',
      `eTIMS Status     : ${record.etims_status.toUpperCase()}`,
      `eTIMS Signature  : ${record.etims_signature || 'N/A'}`,
      '============================================',
      'This document is computer generated.',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${record.invoice_number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Invoice downloaded');
  };

  const exportLedgerCSV = () => {
    if (records.length === 0) {
      toast.info('No records to export');
      return;
    }
    const headers = ['Invoice Number', 'Booking Ref', 'Client Name', 'Client KRA PIN', 'Gross Amount', 'Taxable Value', 'VAT Amount', 'WHT Amount', 'Status', 'Receipt Number', 'Date'];
    const rows = records.map(r => [
      r.invoice_number,
      r.booking?.booking_reference || r.booking_id || 'N/A',
      r.client?.full_name || 'N/A',
      r.client_kra_pin || 'N/A',
      r.gross_amount,
      r.taxable_value,
      r.vat_amount,
      r.wht_amount,
      r.etims_status,
      r.etims_receipt_number || 'N/A',
      new Date(r.created_at).toLocaleDateString()
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tax_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Tax Ledger CSV exported');
  };

  // ── Computed Stats ─────────────────────────────────────────────────────────

  const totalVAT      = records.reduce((s, r) => s + Number(r.vat_amount), 0);
  const totalWHT      = records.reduce((s, r) => s + Number(r.wht_amount), 0);
  const totalGross    = records.reduce((s, r) => s + Number(r.gross_amount), 0);
  const pendingCount  = records.filter(r => r.etims_status === 'pending').length;
  const submittedCount= records.filter(r => r.etims_status === 'submitted').length;
  const failedCount   = records.filter(r => r.etims_status === 'failed').length;
  const exemptCount   = records.filter(r => r.etims_status === 'exempt').length;

  const pieData = [
    { name: 'Pending',   value: pendingCount   },
    { name: 'Submitted', value: submittedCount  },
    { name: 'Exempt',    value: exemptCount     },
    { name: 'Failed',    value: failedCount     },
  ].filter(d => d.value > 0);

  const filtered = statusFilter === 'all' ? records : records.filter(r => r.etims_status === statusFilter);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-in fade-in duration-150">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Receipt size={22} />
            </div>
            <h1 className="text-2xl font-bold text-foreground">KRA Tax Compliance</h1>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
              Admin Only
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Track VAT (16%), Withholding Tax, and manage eTIMS invoice submissions to KRA.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowSeedModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-sm font-bold transition-all border border-border"
          >
            <Hash size={16} />
            Sync Bookings
          </button>
          <button
            onClick={exportLedgerCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-sm font-bold transition-all border border-border"
            title="Export full tax ledger as CSV"
          >
            <FileText size={16} />
            Export CSV
          </button>
          <button
            onClick={transmitAllPending}
            disabled={pendingCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={16} />
            Submit All Pending ({pendingCount})
          </button>
          <button
            onClick={fetchTaxLedger}
            className="p-2.5 bg-muted hover:bg-muted/80 rounded-xl text-muted-foreground transition-colors border border-border"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* KRA Info Banner */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-3">
        <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-600 dark:text-blue-400">
          <span className="font-bold">eTIMS Ready Mode:</span> All invoices are generated in KRA eTIMS compliant format (16% VAT). Click "Submit All Pending" to simulate bulk eTIMS transmission or transmit individually per invoice. This module is <strong>not visible to clients</strong>.
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <SummaryCard
          label="Total VAT Collected"
          value={`KSh ${Math.round(totalVAT).toLocaleString()}`}
          sub="16% VAT on all invoices"
          icon={TrendingUp}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <SummaryCard
          label="Withholding Tax (WHT)"
          value={`KSh ${Math.round(totalWHT).toLocaleString()}`}
          sub="Corporate client deductions"
          icon={Building2}
          iconColor="text-purple-500"
          iconBg="bg-purple-500/10"
        />
        <SummaryCard
          label="Gross Taxable Revenue"
          value={`KSh ${Math.round(totalGross).toLocaleString()}`}
          sub={`Across ${records.length} invoices`}
          icon={Receipt}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/10"
        />
        <SummaryCard
          label="Pending Submissions"
          value={`${pendingCount}`}
          sub={`${submittedCount} submitted · ${failedCount} failed`}
          icon={Clock}
          iconColor="text-amber-500"
          iconBg="bg-amber-500/10"
        />
      </div>

      {/* Chart + Status Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart */}
        <div className="bg-card rounded-2xl border border-border p-6 flex flex-col">
          <h3 className="font-bold text-base mb-1">eTIMS Submission Status</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribution across all invoices</p>
          {pieData.length > 0 ? (
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                      borderRadius: '12px',
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              No records yet
            </div>
          )}
        </div>

        {/* Status Cards */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4 content-start">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const count = records.filter(r => r.etims_status === key).length;
            const amount = records.filter(r => r.etims_status === key).reduce((s, r) => s + Number(r.vat_amount), 0);
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(statusFilter === key as any ? 'all' : key as any)}
                className={`bg-card rounded-2xl border p-5 text-left transition-all hover:shadow-md ${
                  statusFilter === key ? `${cfg.border} ${cfg.bg}` : 'border-border'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${cfg.bg}`}>
                  <Icon size={18} className={cfg.color} />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{cfg.label}</p>
                <p className={`text-2xl font-bold ${cfg.color}`}>{count}</p>
                <p className="text-xs text-muted-foreground mt-1">KSh {Math.round(amount).toLocaleString()} VAT</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <Filter size={14} />
          Filter:
        </div>
        {(['all', 'pending', 'submitted', 'exempt', 'failed'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
              statusFilter === s
                ? 'bg-primary text-white shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {s === 'all' ? `All (${records.length})` : `${s} (${records.filter(r => r.etims_status === s).length})`}
          </button>
        ))}
      </div>

      {/* Tax Ledger Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">eTIMS Invoice Register</h3>
            <p className="text-xs text-muted-foreground mt-0.5">All tax records linked to bookings</p>
          </div>
          <span className="text-xs font-bold text-muted-foreground">{filtered.length} records</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
              <FileText size={28} className="text-muted-foreground" />
            </div>
            <p className="font-bold text-foreground mb-1">No tax records found</p>
            <p className="text-sm text-muted-foreground">Use "Sync Bookings" to populate from existing confirmed bookings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invoice #</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Client</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gross</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">VAT (16%)</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">WHT</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">eTIMS Status</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(rec => {
                  const isExpanded = expandedRow === rec.id;
                  const isTransmitting = transmitting === rec.id;
                  return (
                    <React.Fragment key={rec.id}>
                      <tr className="hover:bg-muted/20 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="font-mono text-xs font-bold text-foreground">{rec.invoice_number}</div>
                          {rec.booking?.booking_reference && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">{rec.booking.booking_reference}</div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-sm font-medium text-foreground">{rec.client?.full_name || 'Unknown'}</div>
                          <div className="text-[10px] text-muted-foreground">{rec.client_kra_pin || 'No KRA PIN'}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm font-bold text-foreground">KSh {Number(rec.gross_amount).toLocaleString()}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm font-bold text-primary">KSh {Number(rec.vat_amount).toLocaleString()}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm text-foreground">{Number(rec.wht_amount) > 0 ? `KSh ${Number(rec.wht_amount).toLocaleString()}` : '—'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={rec.etims_status} />
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs text-muted-foreground">{new Date(rec.created_at).toLocaleDateString()}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : rec.id)}
                              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
                              title="Details"
                            >
                              {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>
                            {rec.etims_status !== 'submitted' && (
                              <button
                                onClick={() => transmitToKRA(rec)}
                                disabled={!!transmitting}
                                className="p-1.5 hover:bg-primary/10 hover:text-primary rounded-lg text-muted-foreground transition-colors disabled:opacity-50"
                                title="Transmit to KRA"
                              >
                                {isTransmitting
                                  ? <Loader2 size={15} className="animate-spin" />
                                  : <Send size={15} />
                                }
                              </button>
                            )}
                            <button
                              onClick={() => downloadInvoice(rec)}
                              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
                              title="Download Invoice"
                            >
                              <Download size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Row */}
                      {isExpanded && (
                        <tr className="bg-muted/10">
                          <td colSpan={8} className="px-5 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">eTIMS Receipt</p>
                                <p className="font-mono text-xs text-foreground">{rec.etims_receipt_number || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Taxable Value</p>
                                <p className="font-bold text-foreground">KSh {Number(rec.taxable_value).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Booking Status</p>
                                <p className="capitalize text-foreground">{rec.booking?.status || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Client Email</p>
                                <p className="text-foreground truncate">{rec.client?.email || '—'}</p>
                              </div>
                              {rec.etims_signature && (
                                <div className="col-span-full">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">eTIMS Digital Signature</p>
                                  <p className="font-mono text-[10px] text-muted-foreground break-all bg-muted p-2 rounded-lg">{rec.etims_signature}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Seed Confirmation Modal */}
      {showSeedModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border p-8 max-w-md w-full shadow-2xl">
            <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-5">
              <AlertTriangle size={26} className="text-amber-500" />
            </div>
            <h3 className="text-xl font-bold mb-2">Sync Bookings to Tax Ledger</h3>
            <p className="text-sm text-muted-foreground mb-6">
              This will import all paid bookings (confirmed, on trip, or completed) that don't yet have a tax record. VAT (16%) will be automatically calculated for each. This action is safe and idempotent — duplicates will be skipped.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSeedModal(false)}
                className="flex-1 py-3 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={seedFromBookings}
                disabled={seeding}
                className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                {seeding ? <><Loader2 size={16} className="animate-spin" /> Syncing...</> : <>Sync Now</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
