import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import {
  Search,
  Filter,
  CheckCircle2,
  Eye,
  Loader2,
  AlertCircle,
  X,
  ChevronDown,
  RefreshCw,
  Smartphone
} from 'lucide-react';
import { toast } from 'sonner';

export function AdminPaymentApprovals() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [processing, setProcessing] = useState(false);

  // Mobile expandable row state
  const [isMobile, setIsMobile] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const data = await adminService.getPaymentRequests();
      setPayments(data || []);
    } catch (error) {
      console.error('Failed to fetch NCBA payment requests:', error);
      toast.error('Failed to fetch NCBA payment requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  // Mobile detection with resize listener
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSync = async (payment: any) => {
    setProcessing(true);
    const promise = (async () => {
      await adminService.syncPaymentRequest(payment.id);
      setSelectedPayment(null);
      await fetchPayments();
    })();

    toast.promise(promise, {
      loading: 'Syncing NCBA payment...',
      success: 'NCBA payment status synced',
      error: 'Failed to sync NCBA payment'
    });

    try {
      await promise;
    } finally {
      setProcessing(false);
    }
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch =
      p.provider_transaction_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.provider_reference_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.booking_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.client?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading && payments.length === 0) {
    return (
      <div className="h-64 w-full flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">NCBA Payment Requests</h2>
          <p className="text-sm text-muted-foreground">Monitor NCBA STK Push attempts, failures, and confirmations.</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                placeholder="Search by Transaction ID, Reference, Booking, or Client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-xs w-72 outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="timeout">Timeout</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table - Desktop View */}
        {!isMobile && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/10">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Booking ID</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Client Name</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">NCBA Transaction</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-muted-foreground truncate block w-24" title={payment.booking_id}>
                        {payment.booking_id?.split('-')[0]}...
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold">{payment.client?.full_name || 'Unknown'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">
                        {payment.provider_transaction_id || payment.provider_reference_id || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold">KES {Number(payment.amount).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">{new Date(payment.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        payment.status === 'success' ? 'bg-success/10 text-success border-success/20' :
                        payment.status === 'failed' ? 'bg-error/10 text-error border-error/20' :
                        'bg-warning/10 text-warning border-warning/20'
                      }`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedPayment(payment)}
                        className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      No payment submissions found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile Expandable Rows */}
        {isMobile && (
          <div className="space-y-2">
            {filteredPayments.map((payment) => (
              <div key={payment.id}>
                {/* Summary Row */}
                <div
                  className="flex justify-between items-center px-4 py-3 bg-card border border-border rounded-xl cursor-pointer select-none hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedRowId(expandedRowId === payment.id ? null : payment.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{payment.provider_transaction_id || payment.provider_reference_id || 'NCBA STK'}</p>
                      <p className="text-xs text-muted-foreground">{payment.client?.full_name || 'Unknown'}</p>
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${expandedRowId === payment.id ? 'rotate-180' : ''}`}
                  />
                </div>

                {/* Expanded Card */}
                {expandedRowId === payment.id && (
                  <div className="bg-card border border-border rounded-xl p-4 mb-3 max-h-[65vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Payment ID</span>
                        <p className="text-sm text-white font-medium break-all">{payment.id}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Booking ID</span>
                        <p className="text-sm text-white font-medium break-all">{payment.booking_id}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Client Name</span>
                        <p className="text-sm text-white font-medium">{payment.client?.full_name || 'Unknown'}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">NCBA Transaction ID</span>
                        <p className="text-sm text-white font-medium font-mono">{payment.provider_transaction_id || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Amount</span>
                        <p className="text-sm text-white font-medium">KES {Number(payment.amount).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Created Date</span>
                        <p className="text-sm text-white font-medium">{new Date(payment.created_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Status</span>
                        <div className="mt-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            payment.status === 'success' ? 'bg-success/10 text-success border-success/20' :
                            payment.status === 'failed' ? 'bg-error/10 text-error border-error/20' :
                            'bg-warning/10 text-warning border-warning/20'
                          }`}>
                            {payment.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border">
                      <button
                        onClick={() => setSelectedPayment(payment)}
                        className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-2"
                      >
                        <Eye size={12} />
                        View Request
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredPayments.length === 0 && (
              <div className="p-12 text-center bg-card border border-border rounded-xl">
                <p className="text-muted-foreground">No payment submissions found matching your criteria.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Detail Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-300">
          <div className="relative w-full max-w-2xl bg-card rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="font-bold text-lg">NCBA Payment Request</h3>
              <button
                onClick={() => setSelectedPayment(null)}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              {/* Booking Summary */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Booking Summary</h4>
                <div className="bg-muted/30 p-4 rounded-xl border border-border grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Booking ID</p>
                    <p className="text-sm font-mono font-bold">{selectedPayment.booking_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Amount Due</p>
                    <p className="text-sm font-bold">KES {Number(selectedPayment.bookings?.total_amount || 0).toLocaleString()}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Dates</p>
                    <p className="text-sm font-bold">
                      {new Date(selectedPayment.bookings?.start_date).toLocaleDateString()} - {new Date(selectedPayment.bookings?.end_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Client Information */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Client Information</h4>
                <div className="bg-muted/30 p-4 rounded-xl border border-border grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-sm font-bold">{selectedPayment.client?.full_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Contact</p>
                    <p className="text-sm font-bold">{selectedPayment.client?.phone_number || selectedPayment.client?.email || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">NCBA Payment Details</h4>
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Transaction ID</p>
                    <p className="text-lg font-mono font-bold text-primary break-all">{selectedPayment.provider_transaction_id || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reference ID</p>
                    <p className="text-lg font-mono font-bold text-primary break-all">{selectedPayment.provider_reference_id || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="text-lg font-bold">KES {Number(selectedPayment.amount).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-lg font-bold">{selectedPayment.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status Description</p>
                    <p className="text-sm font-bold">{selectedPayment.status_description || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created Date</p>
                    <p className="text-sm font-bold">{new Date(selectedPayment.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {selectedPayment.status !== 'success' && (
                <div className="bg-warning/10 p-4 rounded-xl border border-warning/20 flex gap-3">
                  <AlertCircle className="text-warning shrink-0" size={20} />
                  <p className="text-sm text-warning font-medium">
                    NCBA remains the source of truth. Use sync to query the latest STK status; do not manually approve this payment.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border bg-muted/10 flex flex-wrap gap-3 justify-end">
              {selectedPayment.status !== 'success' && (
                <button
                  onClick={() => handleSync(selectedPayment)}
                  disabled={processing || !selectedPayment.provider_transaction_id}
                  className="px-6 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {processing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                  Sync NCBA Status
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
