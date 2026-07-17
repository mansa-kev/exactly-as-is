import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { 
  Plus, 
  Search, 
  Ticket, 
  Trash2, 
  Edit2, 
  Loader2,
  Calendar,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';

export function AdminGrowthTools() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: 0,
    min_booking_amount: 0,
    max_discount: 0,
    expires_at: '',
    usage_limit: 100
  });

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const data = await adminService.getCoupons();
      setCoupons(data || []);
    } catch (error) {
      console.error('Failed to fetch coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const promise = (async () => {
      await adminService.createCoupon(newCoupon);
      setIsAdding(false);
      fetchCoupons();
      setNewCoupon({
        code: '',
        discount_type: 'percentage',
        discount_value: 0,
        min_booking_amount: 0,
        max_discount: 0,
        expires_at: '',
        usage_limit: 100
      });
    })();

    toast.promise(promise, {
      loading: 'Creating coupon...',
      success: 'Coupon created successfully',
      error: 'Failed to create coupon'
    });
  };

  const handleDeleteCoupon = async (id: string) => {
    const promise = (async () => {
      await adminService.deleteCoupon(id);
      fetchCoupons();
    })();

    toast.promise(promise, {
      loading: 'Deleting coupon...',
      success: 'Coupon deleted successfully',
      error: 'Failed to delete coupon'
    });
  };

  const filteredCoupons = coupons.filter(c => 
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && coupons.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Growth Tools</h2>
          <p className="text-muted-foreground">Manage promotions, coupons, and referral programs.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-all"
        >
          <Plus size={20} />
          Create Coupon
        </button>
      </div>

      {isAdding && (
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm animate-in slide-in-from-top duration-300">
          <h3 className="font-bold text-lg mb-4">New Coupon</h3>
          <form onSubmit={handleCreateCoupon} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Code</label>
              <input 
                type="text" 
                required
                value={newCoupon.code}
                onChange={e => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})}
                placeholder="SUMMER2024"
                className="w-full px-4 py-2 bg-muted border-none rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</label>
              <select 
                value={newCoupon.discount_type}
                onChange={e => setNewCoupon({...newCoupon, discount_type: e.target.value})}
                className="w-full px-4 py-2 bg-muted border-none rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Value</label>
              <input 
                type="number" 
                required
                value={newCoupon.discount_value}
                onChange={e => setNewCoupon({...newCoupon, discount_value: Number(e.target.value)})}
                className="w-full px-4 py-2 bg-muted border-none rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Expiry</label>
              <input 
                type="date" 
                required
                value={newCoupon.expires_at}
                onChange={e => setNewCoupon({...newCoupon, expires_at: e.target.value})}
                className="w-full px-4 py-2 bg-muted border-none rounded-xl outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-end gap-2 md:col-span-2 lg:col-span-4">
              <button type="submit" className="px-6 py-2 bg-primary text-primary-foreground rounded-xl font-bold">Save Coupon</button>
              <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2 bg-muted rounded-xl font-bold">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input 
              type="text" 
              placeholder="Search coupons..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-muted border-none rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Coupon Code</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Discount</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Usage</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Expiry</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredCoupons.map((coupon) => {
                const isExpired = new Date(coupon.expires_at) < new Date();
                return (
                  <tr key={coupon.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 text-primary rounded-lg">
                          <Ticket size={18} />
                        </div>
                        <span className="font-bold">{coupon.code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium">
                        {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `$${coupon.discount_value}`}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm">{coupon.usage_count || 0} / {coupon.usage_limit}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar size={14} />
                        <span className="text-sm">{new Date(coupon.expires_at).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        isExpired ? 'bg-error/10 text-error border-error/20' : 'bg-success/10 text-success border-success/20'
                      }`}>
                        {isExpired ? 'Expired' : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors">
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteCoupon(coupon.id)}
                          className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-error transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
