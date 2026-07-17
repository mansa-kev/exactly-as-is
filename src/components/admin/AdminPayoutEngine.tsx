import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { Loader2, CheckCircle2, Clock, Wallet, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

export function AdminPayoutEngine() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayouts, setSelectedPayouts] = useState<string[]>([]);
  
  // Mobile expandable row state
  const [isMobile, setIsMobile] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      // Need to implement getPayouts in adminService
      const data = await adminService.getPayouts();
      setPayouts(data || []);
    } catch (error) {
      console.error('Failed to fetch payouts:', error);
      toast.error('Failed to fetch payouts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, []);

  // Mobile detection with resize listener
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleApproveBatch = async () => {
    if (selectedPayouts.length === 0) return;
    
    const promise = adminService.approvePayouts(selectedPayouts);
    
    toast.promise(promise, {
      loading: 'Approving payouts...',
      success: () => {
        setSelectedPayouts([]);
        fetchPayouts();
        return `${selectedPayouts.length} payouts approved successfully`;
      },
      error: 'Failed to approve payouts'
    });
  };

  if (loading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-8">
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm" style={{ minHeight: '400px' }}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg">Pending Payouts</h3>
          <button 
            onClick={handleApproveBatch}
            disabled={selectedPayouts.length === 0}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50"
          >
            Approve Selected ({selectedPayouts.length})
          </button>
        </div>
        {/* Table - Desktop View */}
        {!isMobile && (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4"><input type="checkbox" onChange={(e) => setSelectedPayouts(e.target.checked ? payouts.filter(p => p.status === 'pending').map(p => p.id) : [])} /></th>
                <th className="p-4 text-xs font-bold uppercase text-muted-foreground">Fleet Owner</th>
                <th className="p-4 text-xs font-bold uppercase text-muted-foreground">Amount</th>
                <th className="p-4 text-xs font-bold uppercase text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.filter(p => p.status === 'pending').map(p => (
                <tr key={p.id} className="border-b border-border">
                  <td className="p-4"><input type="checkbox" checked={selectedPayouts.includes(p.id)} onChange={(e) => setSelectedPayouts(e.target.checked ? [...selectedPayouts, p.id] : selectedPayouts.filter(id => id !== p.id))} /></td>
                  <td className="p-4 font-bold">{p.user_profile?.full_name || 'Unknown'}</td>
                  <td className="p-4">Ksh {Number(p.amount).toLocaleString()}</td>
                  <td className="p-4"><span className="px-2 py-1 bg-warning/10 text-warning rounded-full text-xs font-bold">Pending</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Mobile Expandable Rows */}
        {isMobile && (
          <div className="space-y-2">
            {payouts.filter(p => p.status === 'pending').map(p => (
              <div key={p.id}>
                {/* Summary Row */}
                <div 
                  className="flex justify-between items-center px-4 py-3 bg-card border border-border rounded-xl cursor-pointer select-none hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedRowId(expandedRowId === p.id ? null : p.id)}
                >
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={selectedPayouts.includes(p.id)} 
                      onChange={(e) => setSelectedPayouts(e.target.checked ? [...selectedPayouts, p.id] : selectedPayouts.filter(id => id !== p.id))}
                      className="w-4 h-4"
                    />
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Wallet size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{p.user_profile?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">Ksh {Number(p.amount).toLocaleString()}</p>
                    </div>
                  </div>
                  <ChevronDown 
                    size={16} 
                    className={`transition-transform duration-200 ${expandedRowId === p.id ? 'rotate-180' : ''}`}
                  />
                </div>

                {/* Expanded Card */}
                {expandedRowId === p.id && (
                  <div className="bg-card border border-border rounded-xl p-4 mb-3 max-h-[65vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Payout ID</span>
                        <p className="text-sm text-white font-medium break-all">{p.id}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Fleet Owner</span>
                        <p className="text-sm text-white font-medium">{p.user_profile?.full_name || 'Unknown'}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Amount</span>
                        <p className="text-sm text-white font-medium">Ksh {Number(p.amount).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted uppercase tracking-wide">Status</span>
                        <div className="mt-1">
                          <span className="px-2 py-1 bg-warning/10 text-warning rounded-full text-xs font-bold">Pending</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border">
                      <button 
                        onClick={() => setSelectedPayouts(selectedPayouts.includes(p.id) ? selectedPayouts.filter(id => id !== p.id) : [...selectedPayouts, p.id])}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
                          selectedPayouts.includes(p.id) 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        <CheckCircle2 size={12} />
                        {selectedPayouts.includes(p.id) ? 'Selected' : 'Select'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
