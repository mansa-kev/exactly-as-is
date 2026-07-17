import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { 
  Tag, 
  Plus, 
  Edit3, 
  Trash2, 
  TrendingUp, 
  Zap, 
  Calendar, 
  Percent, 
  DollarSign,
  Info,
  Save,
  X,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

// --- Types ---

interface PricingRule {
  id: string;
  name: string;
  type: 'base' | 'surge' | 'discount';
  category: string;
  value: number;
  unit: 'fixed' | 'percentage';
  status: 'active' | 'inactive';
}

// --- Components ---

export function AdminPricing() {
  const [activeTab, setActiveTab] = useState<'base' | 'dynamic' | 'commission'>('base');
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [formData, setFormData] = useState<Partial<PricingRule>>({
    name: '',
    type: 'base',
    category: 'Economy',
    value: 0,
    unit: 'fixed',
    status: 'active'
  });

  const fetchPricing = async () => {
    setLoading(true);
    try {
      const data = await adminService.getPricingRules();
      setRules(data || []);
    } catch (error) {
      console.error('Failed to fetch pricing rules:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPricing();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const promise = (async () => {
      if (editingRule) {
        await adminService.updatePricingRule(editingRule.id, formData);
      } else {
        await adminService.addPricingRule(formData);
      }
      setIsModalOpen(false);
      setEditingRule(null);
      fetchPricing();
    })();

    toast.promise(promise, {
      loading: 'Saving pricing rule...',
      success: 'Pricing rule saved successfully',
      error: 'Failed to save pricing rule'
    });
  };

  const handleDelete = async (id: string) => {
    const promise = (async () => {
      await adminService.deletePricingRule(id);
      fetchPricing();
    })();

    toast.promise(promise, {
      loading: 'Deleting pricing rule...',
      success: 'Pricing rule deleted successfully',
      error: 'Failed to delete pricing rule'
    });
  };

  const openAddModal = (type: 'base' | 'surge' | 'discount') => {
    setEditingRule(null);
    setFormData({
      name: '',
      type,
      category: type === 'base' ? 'Economy' : 'All Categories',
      value: 0,
      unit: type === 'base' ? 'fixed' : 'percentage',
      status: 'active'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (rule: PricingRule) => {
    setEditingRule(rule);
    setFormData(rule);
    setIsModalOpen(true);
  };

  const baseRates = rules.filter(r => r.type === 'base');
  const dynamicRules = rules.filter(r => r.type !== 'base');

  if (loading && rules.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {['base', 'dynamic', 'commission'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-8 py-4 text-sm font-bold uppercase tracking-widest transition-all relative ${
              activeTab === tab ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab} Rates
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'base' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {baseRates.map((rate) => (
            <div key={rate.id} className="bg-card p-6 rounded-2xl border border-border shadow-sm group">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-primary/10 text-primary rounded-xl">
                  <Tag size={24} />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => openEditModal(rate)}
                    className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(rate.id)}
                    className="p-2 hover:bg-error/10 rounded-lg text-muted-foreground hover:text-error transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">{rate.category}</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">${rate.value}</span>
                <span className="text-sm text-muted-foreground font-medium"> / day</span>
              </div>
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs text-muted-foreground font-medium">{rate.name || 'Standard base rate for this category.'}</p>
              </div>
            </div>
          ))}
          <button 
            onClick={() => openAddModal('base')}
            className="bg-card p-6 rounded-2xl border border-border border-dashed flex flex-col items-center justify-center gap-4 hover:bg-muted/50 transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all">
              <Plus size={24} />
            </div>
            <span className="text-sm font-bold text-muted-foreground group-hover:text-primary transition-colors">Add New Category</span>
          </button>
        </div>
      )}

      {activeTab === 'dynamic' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">Dynamic Pricing Rules</h3>
            <button 
              onClick={() => openAddModal('surge')}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-primary/20"
            >
              <Plus size={18} /> Create Rule
            </button>
          </div>
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Rule Name</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Adjustment</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dynamicRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-foreground">{rule.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {rule.type === 'surge' ? (
                          <Zap size={14} className="text-warning" />
                        ) : (
                          <TrendingUp size={14} className="text-success" />
                        )}
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{rule.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground font-medium">{rule.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-bold ${rule.type === 'surge' ? 'text-warning' : 'text-success'}`}>
                        {rule.type === 'surge' ? '+' : '-'}{rule.value}{rule.unit === 'percentage' ? '%' : '$'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        rule.status === 'active' ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {rule.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openEditModal(rule)}
                          className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(rule.id)}
                          className="p-2 hover:bg-error/10 rounded-lg text-muted-foreground hover:text-error transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-card w-full max-w-md rounded-3xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="text-xl font-bold">{editingRule ? 'Edit Rule' : 'Add New Rule'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rule Name</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="e.g. Weekend Surge"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    <option value="base">Base Rate</option>
                    <option value="surge">Surge</option>
                    <option value="discount">Discount</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</label>
                  <input 
                    type="text" 
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="e.g. Economy"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Value</label>
                  <input 
                    type="number" 
                    required
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Unit</label>
                  <select 
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value as any })}
                    className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    <option value="fixed">Fixed ($)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:scale-[1.02] transition-transform shadow-lg shadow-primary/20">
                  <Save size={18} /> {editingRule ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'commission' && (
        <div className="max-w-2xl bg-card p-8 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <Percent size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Platform Commission</h3>
              <p className="text-sm text-muted-foreground">Set the global commission rate for all bookings.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Platform Fee (%)</label>
              <div className="relative">
                <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input 
                  type="number" 
                  defaultValue={15}
                  className="w-full pl-12 pr-4 py-3 bg-muted border-none rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                <Info size={12} /> This fee is deducted from the total booking amount before payout.
              </p>
            </div>

            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Example: $100 Booking</span>
                <span className="text-sm font-bold text-primary">-$15.00 Fee</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-primary/10">
                <span className="text-sm font-bold">Owner Receives</span>
                <span className="text-lg font-bold text-success">$85.00</span>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:scale-[1.02] transition-transform shadow-lg shadow-primary/20">
                <Save size={18} /> Save Changes
              </button>
              <button className="px-6 py-3 bg-muted hover:bg-muted/80 rounded-xl font-bold transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
