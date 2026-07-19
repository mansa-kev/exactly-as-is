import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { AdminPaymentApprovals } from './AdminPaymentApprovals';
import { AdminPayoutEngine } from './AdminPayoutEngine';
import { AdminPartnerLedger } from './AdminPartnerLedger';
import { AdminFinanceExtras } from './AdminFinanceExtras';
import { createEmptyPayoutBreakdown } from '../../utils/partnerFinancials';
import { 
  DollarSign, 
  TrendingUp, 
  ArrowDownRight, 
  Download, 
  CreditCard, 
  Clock, 
  CheckCircle2,
  MoreHorizontal,
  Loader2,
  Wallet
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { logger } from '../../utils/logger';
import { toast } from 'sonner';

// --- Types ---

interface Transaction {
  id: string;
  type: 'payment_in' | 'payout_out' | 'refund';
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  created_at: string;
  description?: string;
}

// --- Components ---

const TransactionStatus = ({ status }: { status: Transaction['status'] }) => {
  const styles: Record<Transaction['status'], string> = {
    completed: 'bg-success/10 text-success border-success/20',
    pending: 'bg-warning/10 text-warning border-warning/20',
    failed: 'bg-error/10 text-error border-error/20',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status]}`}>
      {status}
    </span>
  );
};

export function AdminFinancials() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab =
    tabParam === 'approvals' || tabParam === 'payouts' || tabParam === 'partner-ledger'
      ? tabParam
      : 'overview';
  const [data, setData] = useState({
    transactions: [] as any[],
    expenses: [] as any[],
    settlements: [] as any[],
    totalRevenue: 0,
    totalPlatformCommission: 0,
    totalPayouts: 0,
    totalExpenses: 0,
    netRevenue: 0,
    pendingSettlementAmount: 0,
    payoutBreakdown: createEmptyPayoutBreakdown(),
    brokerReconciliation: [] as any[],
    bookingReconciliation: [] as any[],
    chartData: [] as any[],
  });
  const [reservationStats, setReservationStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'partner-ledger' | 'approvals' | 'payouts'>(initialTab);
  const [txTab, setTxTab] = useState<'all' | 'payment_in' | 'payout_out'>('all');

  const fetchFinancials = async () => {
    logger.log('AdminFinancials: fetchFinancials called');
    setLoading(true);
    try {
      const result = await adminService.getFinancials();
      logger.log('AdminFinancials: Data received', result);
      setData(result);

      // Fetch reservation stats
      try {
        const resStats = await adminService.getReservationStats();
        setReservationStats(resStats);
      } catch (resError) {
        logger.error('Failed to fetch reservation stats:', resError);
      }
    } catch (error: any) {
      logger.error('Failed to fetch financials:', error);
      toast.error(error?.message || 'Failed to load financials. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, []);

  const {
    totalRevenue,
    totalPlatformCommission,
    totalPayouts,
    totalExpenses,
    netRevenue,
    pendingSettlementAmount,
    chartData,
    settlements,
    payoutBreakdown,
    brokerReconciliation,
    bookingReconciliation,
  } = data;

  const pendingPayouts = pendingSettlementAmount || data.transactions
    .filter(t => t.type === 'payout_out' && t.status === 'pending')
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  const filteredTransactions = data.transactions.filter(t => {
    if (txTab === 'all') return true;
    return t.type === txTab;
  });

  if (loading && data.transactions.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-4 border-b border-border pb-4">
        {[
          { id: 'overview', label: 'Financial Overview' },
          { id: 'partner-ledger', label: 'Partner Ledger' },
          { id: 'approvals', label: 'Payment Approvals' },
          { id: 'payouts', label: 'Payout Engine' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'approvals' ? (
        <AdminPaymentApprovals />
      ) : activeTab === 'payouts' ? (
        <AdminPayoutEngine />
      ) : activeTab === 'partner-ledger' ? (
        <AdminPartnerLedger
          payoutBreakdown={payoutBreakdown}
          brokerReconciliation={brokerReconciliation}
          bookingReconciliation={bookingReconciliation}
          chartData={chartData}
          totalPlatformCommission={totalPlatformCommission}
        />
      ) : (
        <>
          {/* Financial Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl w-fit mb-3"><DollarSign size={20} /></div>
              <h3 className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Gross Revenue</h3>
              <p className="text-xl font-black text-foreground">KSh {totalRevenue.toLocaleString()}</p>
            </div>

            <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
              <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl w-fit mb-3"><TrendingUp size={20} /></div>
              <h3 className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Payouts Settled</h3>
              <p className="text-xl font-black text-foreground">KSh {totalPayouts.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Out KSh {payoutBreakdown.supplierOutsourced.paid.toLocaleString()} ·
                Fleet KSh {payoutBreakdown.supplierFleet.paid.toLocaleString()} ·
                Broker KSh {payoutBreakdown.broker.paid.toLocaleString()}
              </p>
            </div>

            <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
              <div className="p-2.5 bg-warning/10 text-warning rounded-xl w-fit mb-3"><Clock size={20} /></div>
              <h3 className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Pending Payouts</h3>
              <p className="text-xl font-black text-foreground">KSh {pendingPayouts.toLocaleString()}</p>
              <p className="text-[10px] text-amber-500 mt-1">{settlements?.filter(s => s.status === 'pending').length || 0} awaiting</p>
            </div>

            <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
              <div className="p-2.5 bg-error/10 text-error rounded-xl w-fit mb-3"><CreditCard size={20} /></div>
              <h3 className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Expenses</h3>
              <p className="text-xl font-black text-foreground">KSh {totalExpenses.toLocaleString()}</p>
            </div>

            <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 rounded-2xl border border-primary/30 shadow-sm">
              <div className="p-2.5 bg-primary/15 text-primary rounded-xl w-fit mb-3"><Wallet size={20} /></div>
              <h3 className="text-primary text-[10px] font-black uppercase tracking-wider mb-1">Net Platform Revenue</h3>
              <p className="text-2xl font-black text-foreground">KSh {(netRevenue || 0).toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Commission KSh {totalPlatformCommission.toLocaleString()} recorded
              </p>
            </div>
          </div>

          {(settlements?.length > 0 || brokerReconciliation.length > 0) && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-muted/40 border border-border rounded-2xl">
              <p className="text-sm text-muted-foreground">
                Partner payouts are split by outsourced suppliers, fleet owners, and broker referrals.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('partner-ledger')}
                className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold shrink-0"
              >
                Open Partner Ledger
              </button>
            </div>
          )}

          {/* Revenue Chart */}
          <div className="bg-card p-8 rounded-2xl border border-border shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="font-bold text-lg">Revenue vs. Payouts</h3>
                <p className="text-sm text-muted-foreground">Monthly financial performance</p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-xl text-xs font-bold transition-colors">
                <Download size={14} /> Export Report
              </button>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPayouts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--blue-500)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--blue-500)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--card)', 
                      borderColor: 'var(--border)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="var(--primary)" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="payouts" 
                    stroke="var(--blue-500)" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorPayouts)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="font-bold text-lg">Transaction History</h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-muted p-1 rounded-xl">
                  {['all', 'payment_in', 'payout_out'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setTxTab(tab as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        txTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                      }`}
                    >
                      {tab === 'payment_in' ? 'Payments' : tab === 'payout_out' ? 'Payouts' : 'All'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Transaction ID</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-foreground truncate block w-24" title={tx.id}>
                          {tx.id.split('-')[0]}...
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {tx.type === 'payment_in' ? (
                            <div className="p-1.5 bg-success/10 text-success rounded-lg"><CreditCard size={14} /></div>
                          ) : tx.type === 'payout_out' ? (
                            <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg"><Wallet size={14} /></div>
                          ) : (
                            <div className="p-1.5 bg-error/10 text-error rounded-lg"><ArrowDownRight size={14} /></div>
                          )}
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {tx.type === 'payment_in' ? 'Payment' : tx.type === 'payout_out' ? 'Payout' : tx.type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-success' : 'text-foreground'}`}>
                          {tx.amount > 0 ? '+' : ''}KSh {Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4">
                        <TransactionStatus status={tx.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors">
                          <MoreHorizontal size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
