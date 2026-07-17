// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { adminService } from '../../services/adminService';
import { 
  Search, 
  Filter, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  User, 
  Car,
  ChevronRight,
  ArrowUpDown,
  Loader2,
  AlertCircle,
  X,
  CreditCard,
  Clock,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

interface PendingPayment {
  id: string;
  booking_id: string;
  client_id: string;
  amount: number;
  transaction_code: string;
  status: 'submitted' | 'verified' | 'rejected';
  verified_by?: string;
  verified_at?: string;
  created_at: string;
  bookings?: any;
  user_profiles?: any;
}

export function AdminPendingPayments() {
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'verified' | 'rejected'>('all');
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pending_payments')
        .select(`
          *,
          bookings!inner(
            *,
            cars!inner(*),
            client:user_profiles!bookings_client_id_fkey(*)
          ),
          client:user_profiles!pending_payments_client_id_fkey(*)
        `)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Failed to fetch pending payments:', error);
      toast.error('Failed to fetch pending payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleVerifyPayment = async (paymentId: string, status: 'verified' | 'rejected') => {
    try {
      const payment = payments.find(p => p.id === paymentId);
      if (!payment) {
        toast.error('Payment not found');
        return;
      }

      // Get current admin user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Admin authentication required');
        return;
      }

      const result = await adminService.verifyPayment(
        paymentId,
        status,
        user.id,
        payment.booking_id,
        payment.amount,
        payment.client_id,
        payment.transaction_code
      );

      if (result) {
        toast.success(`Payment ${status} successfully`);
        fetchPayments();
        setSelectedPayment(null);
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      toast.error('Failed to verify payment');
    }
  };

  const filteredPayments = payments.filter(payment => {
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    const clientName = payment.client?.full_name || payment.bookings?.client?.full_name || 'Unknown';
    const carModel = `${payment.bookings?.cars?.make} ${payment.bookings?.cars?.model}` || 'Unknown Car';
    
    const matchesSearch = clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          payment.transaction_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          carModel.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          payment.booking_id.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      submitted: 'bg-warning/10 text-warning border-warning/20',
      verified: 'bg-success/10 text-success border-success/20',
      rejected: 'bg-error/10 text-error border-error/20',
    };

    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status] || 'bg-muted text-muted-foreground'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-1 md:gap-2 overflow-x-auto pb-2 md:pb-0">
          {['all', 'submitted', 'verified', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as any)}
              className={`px-2 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all ${
                statusFilter === status 
                  ? 'bg-warning text-white shadow-lg shadow-warning/20' 
                  : 'bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input 
              type="text" 
              placeholder="Search payments..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 md:pl-10 md:pr-4 md:py-2 bg-card border border-border rounded-lg md:rounded-xl text-xs md:text-sm w-full md:w-64 focus:ring-2 focus:ring-warning/20 transition-all outline-none"
            />
          </div>
          <button 
            onClick={fetchPayments}
            className="p-1.5 md:p-2 rounded-lg md:rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl md:rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 md:px-6 py-2 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <div className="flex items-center gap-1 md:gap-2 cursor-pointer hover:text-foreground transition-colors">
                    Payment ID <ArrowUpDown size={10} />
                  </div>
                </th>
                <th className="px-3 md:px-6 py-2 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">Client</th>
                <th className="px-3 md:px-6 py-2 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">Car</th>
                <th className="hidden md:table-cell px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Booking ID</th>
                <th className="px-3 md:px-6 py-2 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">M-Pesa Code</th>
                <th className="px-3 md:px-6 py-2 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount</th>
                <th className="px-3 md:px-6 py-2 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-3 md:px-6 py-2 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-3 md:px-6 py-2 md:py-4">
                    <span className="text-xs md:text-sm font-bold text-foreground truncate block w-16 md:w-24" title={payment.id}>
                      {payment.id.split('-')[0]}...
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-2 md:py-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <User size={12} />
                      </div>
                      <span className="text-xs md:text-sm font-medium text-foreground truncate max-w-[100px] md:max-w-none">
                        {payment.client?.full_name || payment.bookings?.client?.full_name || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 md:px-6 py-2 md:py-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      <Car size={12} className="text-muted-foreground" />
                      <span className="text-xs md:text-sm text-foreground truncate max-w-[80px] md:max-w-none">
                        {payment.bookings?.cars?.make} {payment.bookings?.cars?.model}
                      </span>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4">
                    <span className="text-xs md:text-sm font-mono">{payment.booking_id.split('-')[0]}...</span>
                  </td>
                  <td className="px-3 md:px-6 py-2 md:py-4">
                    <span className="text-xs md:text-sm font-mono text-warning font-bold">{payment.transaction_code}</span>
                  </td>
                  <td className="px-3 md:px-6 py-2 md:py-4">
                    <span className="text-xs md:text-sm font-bold text-foreground">KES {payment.amount.toLocaleString()}</span>
                  </td>
                  <td className="px-3 md:px-6 py-2 md:py-4">
                    <StatusBadge status={payment.status} />
                  </td>
                  <td className="px-3 md:px-6 py-2 md:py-4 text-right">
                    <div className="flex items-center justify-end gap-1 md:gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setSelectedPayment(payment)}
                        className="p-1.5 md:p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-warning transition-colors" 
                        title="View Details"
                      >
                        <Eye size={14} />
                      </button>
                      {payment.status === 'submitted' && (
                        <>
                          <button 
                            onClick={() => handleVerifyPayment(payment.id, 'verified')}
                            className="p-1.5 md:p-2 hover:bg-success/10 rounded-lg text-muted-foreground hover:text-success transition-colors" 
                            title="Verify Payment"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          <button 
                            onClick={() => handleVerifyPayment(payment.id, 'rejected')}
                            className="p-1.5 md:p-2 hover:bg-error/10 rounded-lg text-muted-foreground hover:text-error transition-colors" 
                            title="Reject Payment"
                          >
                            <XCircle size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredPayments.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-muted-foreground">No pending payments found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Payment Detail Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl md:rounded-2xl shadow-xl w-full max-w-4xl max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-border">
              <div>
                <h2 className="text-lg md:text-xl font-bold">Payment Details</h2>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">ID: {selectedPayment.id}</p>
              </div>
              <button 
                onClick={() => setSelectedPayment(null)}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4 md:p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                
                {/* Left Column */}
                <div className="space-y-4 md:space-y-8">
                  {/* Payment Summary */}
                  <section>
                    <h3 className="text-xs md:text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 md:mb-4 flex items-center gap-2">
                      <CreditCard size={14} /> Payment Summary
                    </h3>
                    <div className="bg-muted/30 p-3 md:p-4 rounded-xl space-y-3 md:space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs md:text-sm text-muted-foreground">Status</span>
                        <StatusBadge status={selectedPayment.status} />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs md:text-sm text-muted-foreground">M-Pesa Code</span>
                        <span className="text-xs md:text-sm font-mono text-warning font-bold">{selectedPayment.transaction_code}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs md:text-sm text-muted-foreground">Amount</span>
                        <span className="text-xs md:text-sm font-bold text-foreground">KES {selectedPayment.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs md:text-sm text-muted-foreground">Submitted</span>
                        <span className="text-xs md:text-sm font-medium">{new Date(selectedPayment.created_at).toLocaleDateString()}</span>
                      </div>
                      {selectedPayment.verified_at && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs md:text-sm text-muted-foreground">Verified</span>
                          <span className="text-xs md:text-sm font-medium">{new Date(selectedPayment.verified_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Booking Information */}
                  <section>
                    <h3 className="text-xs md:text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 md:mb-4 flex items-center gap-2">
                      <Calendar size={14} /> Booking Information
                    </h3>
                    <div className="bg-muted/30 p-3 md:p-4 rounded-xl space-y-3 md:space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs md:text-sm text-muted-foreground">Booking ID</span>
                        <span className="text-xs md:text-sm font-mono">{selectedPayment.booking_id}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs md:text-sm text-muted-foreground">Car</span>
                        <span className="text-xs md:text-sm font-bold">{selectedPayment.bookings?.cars?.make} {selectedPayment.bookings?.cars?.model}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs md:text-sm text-muted-foreground">Rental Dates</span>
                        <span className="text-xs md:text-sm font-medium">{selectedPayment.bookings?.start_date} to {selectedPayment.bookings?.end_date}</span>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Right Column */}
                <div className="space-y-4 md:space-y-8">
                  {/* Client Information */}
                  <section>
                    <h3 className="text-xs md:text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 md:mb-4 flex items-center gap-2">
                      <User size={14} /> Client Information
                    </h3>
                    <div className="bg-muted/30 p-3 md:p-4 rounded-xl space-y-3 md:space-y-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {selectedPayment.client?.full_name?.charAt(0) || selectedPayment.bookings?.client?.full_name?.charAt(0) || 'C'}
                        </div>
                        <div>
                          <p className="font-bold text-sm md:text-base">
                            {selectedPayment.client?.full_name || selectedPayment.bookings?.client?.full_name || 'Unknown Client'}
                          </p>
                          <p className="text-xs md:text-sm text-muted-foreground">
                            {selectedPayment.client?.email || selectedPayment.bookings?.client?.email || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Verification Details */}
                  {selectedPayment.verified_by && (
                    <section>
                      <h3 className="text-xs md:text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 md:mb-4 flex items-center gap-2">
                        <ShieldCheck size={14} /> Verification Details
                      </h3>
                      <div className="bg-muted/30 p-3 md:p-4 rounded-xl space-y-3 md:space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs md:text-sm text-muted-foreground">Verified By</span>
                          <span className="text-xs md:text-sm font-medium">{selectedPayment.verified_by}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs md:text-sm text-muted-foreground">Verified At</span>
                          <span className="text-xs md:text-sm font-medium">{new Date(selectedPayment.verified_at!).toLocaleString()}</span>
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-3 md:p-6 border-t border-border bg-muted/10 flex flex-wrap gap-2 md:gap-3 justify-end">
              {selectedPayment.status === 'submitted' && (
                <>
                  <button 
                    onClick={() => {
                      handleVerifyPayment(selectedPayment.id, 'verified');
                      setSelectedPayment(null);
                    }}
                    className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-bold bg-success text-white hover:bg-success/90 transition-colors flex items-center gap-2 text-xs md:text-sm"
                  >
                    <CheckCircle2 size={14} /> Verify Payment
                  </button>
                  <button 
                    onClick={() => {
                      handleVerifyPayment(selectedPayment.id, 'rejected');
                      setSelectedPayment(null);
                    }}
                    className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-bold bg-error text-white hover:bg-error/90 transition-colors flex items-center gap-2 text-xs md:text-sm"
                  >
                    <XCircle size={14} /> Reject Payment
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}