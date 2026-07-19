import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Loader2, Clock, CheckCircle2, XCircle, CreditCard, DollarSign, Calendar, User, Car, ChevronRight, RefreshCw } from 'lucide-react';
import { computeExtensionQuote } from '../../utils/extensionQuote';
import { extensionPaymentService } from '../../services/extensionPaymentService';
import { checkExtensionEligibility, EXTENSION_CUTOFF_HOURS } from '../../utils/extensionWindow';

type OpenStatus = 'requested' | 'quoted' | 'awaiting_payment';

interface ExtRow {
  id: string;
  booking_id: string;
  status: OpenStatus | string;
  payment_status: string;
  requester_role: string;
  reason: string | null;
  days_extended: number;
  hours_extended: number;
  new_end_date: string;
  original_end_date: string | null;
  total_amount: number;
  amount_paid: number;
  base_amount: number;
  fee_amount: number;
  discount_amount: number;
  tax_amount: number;
  created_at: string;
  bookings: {
    id: string;
    end_date: string;
    contact_phone: string | null;
    client_id: string;
    total_amount: number;
    cars: { make: string; model: string; daily_rate: number; license_plate: string } | null;
    users: { full_name: string; email: string; phone: string | null } | null;
  } | null;
}

export function AdminExtensionRequestsQueue() {
  const [rows, setRows] = useState<ExtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ExtRow | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('booking_extensions')
      .select(`
        *,
        bookings:booking_id (
          id, end_date, contact_phone, client_id, total_amount,
          cars:car_id ( make, model, daily_rate, license_plate ),
          users:client_id ( full_name, email, phone )
        )
      `)
      .in('status', ['requested', 'quoted', 'awaiting_payment'])
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load extensions: ' + error.message);
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
    const ch = supabase
      .channel('admin-ext-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_extensions' }, () => fetchRows())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const counts = useMemo(() => ({
    requested: rows.filter(r => r.status === 'requested').length,
    quoted: rows.filter(r => r.status === 'quoted').length,
    awaiting_payment: rows.filter(r => r.status === 'awaiting_payment').length,
  }), [rows]);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Clock size={20} className="text-orange-500" /> Extension Requests Queue
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Client-initiated requests, admin quotes, and outstanding payments — all in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatChip label="New" count={counts.requested} tone="orange" />
          <StatChip label="Quoted" count={counts.quoted} tone="blue" />
          <StatChip label="Unpaid" count={counts.awaiting_payment} tone="red" />
          <button onClick={fetchRows} className="p-2 hover:bg-muted rounded-lg" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-border">
        <div className="lg:col-span-2 max-h-[600px] overflow-y-auto">
          {loading && rows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              <CheckCircle2 size={32} className="mx-auto mb-2 opacity-40" />
              No pending extension requests.
            </div>
          ) : rows.map(r => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className={`w-full text-left p-4 border-b border-border/60 transition-colors ${
                selected?.id === r.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-muted/40 border-l-4 border-l-transparent'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <StatusBadge status={r.status as OpenStatus} />
                <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <div className="text-sm font-bold truncate">
                {r.bookings?.users?.full_name || 'Client'} • {r.bookings?.cars?.make} {r.bookings?.cars?.model}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                +{r.days_extended}d {r.hours_extended ? `${r.hours_extended}h` : ''} → {new Date(r.new_end_date).toLocaleDateString()}
              </div>
              <div className="text-xs font-black text-primary mt-1">
                {r.total_amount > 0 ? `KES ${Number(r.total_amount).toLocaleString()}` : 'Awaiting quote'}
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-3 min-h-[600px]">
          {selected ? (
            <ExtensionDetail key={selected.id} row={selected} onChange={fetchRows} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-muted-foreground">
              <ChevronRight size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Select a request on the left to review.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, count, tone }: { label: string; count: number; tone: 'orange' | 'blue' | 'red' }) {
  const cls = tone === 'orange' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
    : tone === 'blue' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    : 'bg-error/10 text-error border-error/20';
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cls}`}>
      {label} {count}
    </span>
  );
}

function StatusBadge({ status }: { status: OpenStatus }) {
  const map: Record<OpenStatus, string> = {
    requested: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    quoted: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    awaiting_payment: 'bg-error/10 text-error border-error/20',
  };
  const label: Record<OpenStatus, string> = {
    requested: 'New Request',
    quoted: 'Quoted',
    awaiting_payment: 'Awaiting Payment',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function ExtensionDetail({ row, onChange }: { row: ExtRow; onChange: () => void }) {
  const bk = row.bookings;
  const dailyRate = bk?.cars?.daily_rate || 0;
  const currentEnd = row.original_end_date || bk?.end_date || new Date().toISOString();

  // Editable quote (defaults to existing values or client's ask)
  const [days, setDays] = useState(row.days_extended || 1);
  const [hours, setHours] = useState(Number(row.hours_extended) || 0);
  const [fee, setFee] = useState(Number(row.fee_amount) || 0);
  const [discount, setDiscount] = useState(Number(row.discount_amount) || 0);
  const [taxRate, setTaxRate] = useState(row.base_amount > 0 && row.tax_amount > 0
    ? Math.round((Number(row.tax_amount) / Number(row.base_amount)) * 100) : 0);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);

  const [showStk, setShowStk] = useState(false);
  const [phone, setPhone] = useState(bk?.contact_phone || bk?.users?.phone || '');
  const [cashRef, setCashRef] = useState('');
  const [showCash, setShowCash] = useState(false);

  const quote = useMemo(() => computeExtensionQuote({
    currentEndDate: currentEnd,
    dailyRate,
    days,
    hours,
    adminFee: fee,
    discount,
    taxRate: taxRate / 100,
  }), [currentEnd, dailyRate, days, hours, fee, discount, taxRate]);


  const isAwaiting = row.status === 'awaiting_payment';
  const isPending = row.status === 'requested' || row.status === 'quoted';

  const eligibility = checkExtensionEligibility(bk);

  const saveQuote = async (advanceToAwaiting: boolean) => {
    if (advanceToAwaiting && !eligibility.eligible) {
      toast.error(eligibility.reason || 'This booking can no longer be extended.');
      return;
    }
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      const update: any = {
        days_extended: quote.days,
        hours_extended: quote.hours,
        new_end_date: quote.newEndDate,
        base_amount: quote.base,
        fee_amount: quote.adminFee,
        discount_amount: quote.discount,
        tax_amount: quote.tax,
        total_amount: quote.total,
        pricing_breakdown: {
          base: quote.base, admin_fee: quote.adminFee,
          discount: quote.discount, tax: quote.tax, tax_rate: taxRate,
        },
        quoted_by: uid,
        quoted_at: new Date().toISOString(),
        status: advanceToAwaiting ? 'awaiting_payment' : 'quoted',
      };
      if (advanceToAwaiting) {
        update.approved_by = uid;
        update.approved_at = new Date().toISOString();
      }
      const { error } = await supabase.from('booking_extensions').update(update).eq('id', row.id);
      if (error) throw error;
      const clientId = (row as any).bookings?.client_id;
      if (clientId) {
        await supabase.from('notifications').insert({
          user_id: clientId,
          title: advanceToAwaiting ? 'Extension Ready for Payment' : 'Extension Quote Updated',
          content: advanceToAwaiting
            ? `Your extension has been approved. Amount due: KES ${Number(quote.total).toLocaleString()}. New return: ${new Date(quote.newEndDate).toLocaleString()}.`
            : `Admin prepared a quote of KES ${Number(quote.total).toLocaleString()} for your extension request.`,
          type: advanceToAwaiting ? 'warning' : 'info',
          is_read: false,
          link: `/bookings/${row.booking_id}`,
        }).then(() => {}, (e: any) => console.error('[ext-notif]', e));
      }
      toast.success(advanceToAwaiting ? 'Quote approved — client can now pay' : 'Quote saved');
      onChange();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save quote');
    } finally { setBusy(false); }
  };

  const rejectRequest = async () => {
    if (!rejectReason.trim()) return toast.error('Please provide a reason');
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      const { error } = await supabase.from('booking_extensions').update({
        status: 'rejected',
        rejected_by: uid,
        rejected_at: new Date().toISOString(),
        rejection_reason: rejectReason.trim(),
      }).eq('id', row.id);
      if (error) throw error;
      const clientId = (row as any).bookings?.client_id;
      if (clientId) {
        await supabase.from('notifications').insert({
          user_id: clientId,
          title: 'Extension Request Declined',
          content: `Your extension request was declined. Reason: ${rejectReason.trim()}`,
          type: 'error',
          is_read: false,
          link: `/bookings/${row.booking_id}`,
        }).then(() => {}, (e: any) => console.error('[ext-notif]', e));
      }
      toast.success('Extension rejected');
      onChange();
    } catch (e: any) {
      toast.error(e.message || 'Failed to reject');
    } finally { setBusy(false); }
  };

  const sendStk = async () => {
    if (!phone) return toast.error('Enter phone');
    setBusy(true);
    try {
      const res = await extensionPaymentService.initiateSTKPush({ phone, extensionId: row.id });
      if (!res.success || !res.paymentRequestId) { toast.error(res.error || 'Failed'); return; }
      toast.info('STK sent — waiting for PIN…');
      const outcome = await extensionPaymentService.pollUntilPaid(res.paymentRequestId, row.id);
      if (outcome === 'paid') { toast.success('Paid & applied'); onChange(); }
      else toast.error(outcome === 'failed' ? 'Payment failed' : 'Timed out');
    } finally { setBusy(false); setShowStk(false); }
  };

  const markCash = async () => {
    setBusy(true);
    try {
      const res = await extensionPaymentService.markPaidCash({
        bookingId: row.booking_id, extensionId: row.id, reference: cashRef, method: 'cash',
      });
      if (!res.success) return toast.error(res.error || 'Failed');
      toast.success('Marked paid'); onChange();
    } finally { setBusy(false); setShowCash(false); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border bg-card">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <InfoBlock icon={<User size={12} />} label="Client"
            value={bk?.users?.full_name || '—'}
            sub={bk?.users?.email || ''} />
          <InfoBlock icon={<Car size={12} />} label="Vehicle"
            value={`${bk?.cars?.make || ''} ${bk?.cars?.model || ''}`}
            sub={bk?.cars?.license_plate || ''} />
          <InfoBlock icon={<Calendar size={12} />} label="Current return"
            value={new Date(currentEnd).toLocaleString()} />
          <InfoBlock icon={<Calendar size={12} />} label="Requested new return"
            value={new Date(row.new_end_date).toLocaleString()} />
        </div>
        {row.reason && (
          <div className="p-3 bg-muted/40 rounded-xl border border-border">
            <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Client reason</div>
            <p className="text-sm">{row.reason}</p>
          </div>
        )}
      </div>

      {/* Quote editor / payment actions */}
      <div className="p-6 flex-1 overflow-y-auto space-y-5">
        {isPending && (
          <>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">Duration</div>
              <div className="grid grid-cols-2 gap-3">
                <LabeledNumber label="Days" value={days} onChange={setDays} min={0} />
                <LabeledNumber label="Hours" value={hours} onChange={setHours} min={0} max={23} />
              </div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">Adjustments</div>
              <div className="grid grid-cols-3 gap-3">
                <LabeledNumber label="Admin fee (KES)" value={fee} onChange={setFee} min={0} />
                <LabeledNumber label="Discount (KES)" value={discount} onChange={setDiscount} min={0} />
                <LabeledNumber label="Tax (%)" value={taxRate} onChange={setTaxRate} min={0} max={100} />
              </div>
            </div>

            <ReceiptPanel dailyRate={dailyRate} quote={quote} newEnd={quote.newEndDate} />
          </>
        )}

        {isAwaiting && (
          <div className="p-4 bg-error/5 border border-error/20 rounded-xl">
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="text-[10px] font-black uppercase text-error">Outstanding</div>
                <div className="text-2xl font-black">KES {(Number(row.total_amount) - Number(row.amount_paid)).toLocaleString()}</div>
              </div>
              <DollarSign size={32} className="text-error/40" />
            </div>
            {!showStk && !showCash && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowStk(true)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-black flex items-center gap-2">
                  <CreditCard size={14} /> Send STK Push
                </button>
                <button onClick={() => setShowCash(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-black">
                  Mark Paid (Cash)
                </button>
              </div>
            )}
            {showStk && (
              <div className="flex items-center gap-2 mt-2">
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XXXXXXXX"
                  className="px-3 py-2 bg-card border border-border rounded-lg text-xs flex-1 outline-none" />
                <button onClick={sendStk} disabled={busy} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-black disabled:opacity-50">
                  {busy ? <Loader2 size={12} className="animate-spin" /> : 'Send'}
                </button>
                <button onClick={() => setShowStk(false)} className="px-2 py-2 text-xs text-muted-foreground">Cancel</button>
              </div>
            )}
            {showCash && (
              <div className="flex items-center gap-2 mt-2">
                <input type="text" value={cashRef} onChange={e => setCashRef(e.target.value)} placeholder="Receipt / ref (optional)"
                  className="px-3 py-2 bg-card border border-border rounded-lg text-xs flex-1 outline-none" />
                <button onClick={markCash} disabled={busy} className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-black disabled:opacity-50">
                  {busy ? <Loader2 size={12} className="animate-spin" /> : 'Confirm'}
                </button>
                <button onClick={() => setShowCash(false)} className="px-2 py-2 text-xs text-muted-foreground">Cancel</button>
              </div>
            )}
          </div>
        )}

        {showReject && (
          <div className="p-4 bg-error/5 border border-error/20 rounded-xl">
            <div className="text-[10px] font-black uppercase text-error mb-2">Rejection reason</div>
            <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm outline-none"
              placeholder="Explain why this extension can't be granted…" />
            <div className="flex gap-2 mt-2">
              <button onClick={rejectRequest} disabled={busy} className="px-4 py-2 bg-error text-white rounded-lg text-xs font-black disabled:opacity-50">
                Confirm Reject
              </button>
              <button onClick={() => setShowReject(false)} className="px-4 py-2 text-xs text-muted-foreground">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      {isPending && !showReject && (
        <div className="p-4 border-t border-border bg-card flex flex-wrap gap-2 justify-end">
          <button onClick={() => setShowReject(true)} disabled={busy}
            className="px-4 py-2 bg-error/10 text-error hover:bg-error hover:text-white rounded-xl text-xs font-black transition-colors flex items-center gap-2">
            <XCircle size={14} /> Reject
          </button>
          <button onClick={() => saveQuote(false)} disabled={busy}
            className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-xl text-xs font-black flex items-center gap-2">
            {busy ? <Loader2 size={14} className="animate-spin" /> : null} Save Quote
          </button>
          <button onClick={() => saveQuote(true)} disabled={busy}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-black flex items-center gap-2 disabled:opacity-50">
            <CheckCircle2 size={14} /> Approve → Awaiting Payment
          </button>
        </div>
      )}
    </div>
  );
}

function InfoBlock({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="p-3 bg-muted/40 rounded-xl border border-border">
      <div className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1 mb-1">{icon} {label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

function LabeledNumber({ label, value, onChange, min = 0, max }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase text-muted-foreground">{label}</span>
      <input type="number" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="mt-1 w-full px-3 py-2 bg-card border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20" />
    </label>
  );
}

function ReceiptPanel({ dailyRate, quote, newEnd }: { dailyRate: number; quote: ReturnType<typeof computeExtensionQuote>; newEnd: string }) {
  return (
    <div className="p-4 bg-muted/40 rounded-xl border border-border">
      <div className="text-[10px] font-black uppercase text-muted-foreground mb-3">Receipt Preview</div>
      <div className="space-y-1.5 text-xs">
        <Row k={`Base (${quote.days}d ${quote.hours}h @ KES ${dailyRate.toLocaleString()}/day)`} v={quote.base} />
        {quote.adminFee > 0 && <Row k="Admin fee" v={quote.adminFee} />}
        {quote.discount > 0 && <Row k="Discount" v={-quote.discount} />}
        {quote.tax > 0 && <Row k="Tax" v={quote.tax} />}
        <div className="border-t border-border my-2" />
        <Row k="Total" v={quote.total} bold />
      </div>
      <div className="mt-3 text-[11px] text-muted-foreground">
        New return: <span className="font-bold text-foreground">{new Date(newEnd).toLocaleString()}</span>
      </div>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-black text-sm' : ''}`}>
      <span className="text-muted-foreground">{k}</span>
      <span>{v < 0 ? '-' : ''}KES {Math.abs(v).toLocaleString()}</span>
    </div>
  );
}
