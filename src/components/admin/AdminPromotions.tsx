import React, { useState, useEffect } from 'react';
import { promotionService, Promotion } from '../../services/promotionService';
import { adminService } from '../../services/adminService';
import {
  Tag,
  Plus,
  Edit3,
  Trash2,
  Calendar,
  Percent,
  DollarSign,
  Save,
  X,
  Loader2,
  Megaphone,
  Clock,
  ToggleLeft,
  ToggleRight,
  Zap,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

interface PricingRule {
  id: string;
  name: string;
  type: 'base' | 'surge' | 'discount';
  category: string;
  value: number;
  unit: 'fixed' | 'percentage';
  status: 'active' | 'inactive';
}

const CATEGORIES = ['all', 'suv', 'sedan', 'luxury', 'economy', 'compact', 'sports', 'van'];

function getCountdown(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, mins };
}

export function AdminPromotions() {
  const [activeTab, setActiveTab] = useState<'promotions' | 'base' | 'commission'>('promotions');
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [, setTick] = useState(0);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 0,
    category: 'all',
    banner_text: '',
    start_date: '',
    end_date: '',
    is_active: true,
  });

  // Tick for countdown
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [promos, pricingRules] = await Promise.all([
        promotionService.getAll(),
        adminService.getPricingRules()
      ]);
      setPromotions(promos);
      setRules(pricingRules || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreateModal = () => {
    setEditingPromo(null);
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setFormData({
      title: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 10,
      category: 'all',
      banner_text: '',
      start_date: now.toISOString().slice(0, 16),
      end_date: nextWeek.toISOString().slice(0, 16),
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (promo: Promotion) => {
    setEditingPromo(promo);
    setFormData({
      title: promo.title,
      description: promo.description || '',
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      category: promo.category || 'all',
      banner_text: promo.banner_text || '',
      start_date: promo.start_date ? new Date(promo.start_date).toISOString().slice(0, 16) : '',
      end_date: promo.end_date ? new Date(promo.end_date).toISOString().slice(0, 16) : '',
      is_active: promo.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const promise = (async () => {
      if (editingPromo) {
        await promotionService.update(editingPromo.id, formData);
      } else {
        await promotionService.create(formData);
      }
      setIsModalOpen(false);
      setEditingPromo(null);
      fetchData();
    })();
    toast.promise(promise, {
      loading: editingPromo ? 'Updating promotion...' : 'Creating promotion...',
      success: editingPromo ? 'Promotion updated!' : 'Promotion created!',
      error: 'Failed to save promotion',
    });
  };

  const handleDeletePromo = async (id: string) => {
    const promise = (async () => {
      await promotionService.delete(id);
      fetchData();
    })();
    toast.promise(promise, {
      loading: 'Deleting promotion...',
      success: 'Promotion deleted',
      error: 'Failed to delete promotion',
    });
  };

  const handleToggleActive = async (promo: Promotion) => {
    try {
      await promotionService.toggleActive(promo.id, !promo.is_active);
      toast.success(promo.is_active ? 'Promotion deactivated' : 'Promotion activated');
      fetchData();
    } catch {
      toast.error('Failed to toggle promotion');
    }
  };

  // Base rates
  const baseRates = rules.filter(r => r.type === 'base');

  const handleDeleteRule = async (id: string) => {
    const promise = (async () => {
      await adminService.deletePricingRule(id);
      fetchData();
    })();
    toast.promise(promise, { loading: 'Deleting...', success: 'Deleted', error: 'Failed' });
  };

  const isPromoActive = (p: Promotion) => {
    const now = Date.now();
    return p.is_active && new Date(p.start_date).getTime() <= now && new Date(p.end_date).getTime() >= now;
  };

  if (loading && promotions.length === 0) {
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
        {(['promotions', 'base', 'commission'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-8 py-4 text-sm font-bold uppercase tracking-widest transition-all relative ${
              activeTab === tab ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'promotions' ? 'Promotions' : tab === 'base' ? 'Base Rates' : 'Commission'}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Promotions Tab */}
      {activeTab === 'promotions' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">Promotional Discounts</h3>
              <p className="text-sm text-muted-foreground">Manage time-limited promotions that appear on the website</p>
            </div>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-primary/20"
            >
              <Plus size={18} /> Create Promotion
            </button>
          </div>

          {promotions.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-2xl border border-border">
              <Megaphone className="mx-auto text-muted-foreground mb-4" size={48} />
              <p className="text-lg font-bold text-muted-foreground mb-2">No promotions yet</p>
              <p className="text-sm text-muted-foreground">Create your first promotion to attract customers</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promotions.map((promo) => {
                const active = isPromoActive(promo);
                const countdown = getCountdown(promo.end_date);
                const expired = new Date(promo.end_date).getTime() < Date.now();

                return (
                  <div
                    key={promo.id}
                    className={`bg-card rounded-2xl border shadow-sm overflow-hidden group ${
                      active ? 'border-primary/30' : 'border-border'
                    }`}
                  >
                    {/* Status Bar */}
                    <div className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center justify-between ${
                      active ? 'bg-primary/10 text-primary' : expired ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'
                    }`}>
                      <span className="flex items-center gap-1.5">
                        {active ? <Zap size={10} /> : null}
                        {active ? 'Live' : expired ? 'Expired' : 'Inactive'}
                      </span>
                      {countdown && active && (
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {countdown.days}d {countdown.hours}h {countdown.mins}m left
                        </span>
                      )}
                    </div>

                    <div className="p-6 space-y-4">
                      {/* Discount Badge */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-foreground text-lg">{promo.title}</h4>
                          {promo.description && (
                            <p className="text-sm text-muted-foreground mt-1">{promo.description}</p>
                          )}
                        </div>
                        <div className="px-3 py-1.5 bg-primary/10 rounded-xl text-primary font-black text-lg shrink-0 ml-3">
                          {promo.discount_type === 'percentage'
                            ? `${promo.discount_value}%`
                            : `KES ${promo.discount_value}`
                          }
                          <span className="text-[10px] block text-center font-bold">OFF</span>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Tag size={12} />
                          <span className="capitalize">{promo.category === 'all' ? 'All Categories' : promo.category}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar size={12} />
                          <span>
                            {new Date(promo.start_date).toLocaleDateString()} — {new Date(promo.end_date).toLocaleDateString()}
                          </span>
                        </div>
                        {promo.banner_text && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Megaphone size={12} />
                            <span className="truncate">{promo.banner_text}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-4 border-t border-border">
                        <button
                          onClick={() => handleToggleActive(promo)}
                          className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                            promo.is_active ? 'text-primary hover:text-primary/80' : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {promo.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          {promo.is_active ? 'Active' : 'Inactive'}
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(promo)}
                            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeletePromo(promo.id)}
                            className="p-2 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Base Rates Tab */}
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
                    onClick={() => handleDeleteRule(rate.id)}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">{rate.category}</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">KES {rate.value}</span>
                <span className="text-sm text-muted-foreground font-medium"> / day</span>
              </div>
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs text-muted-foreground font-medium">{rate.name || 'Standard base rate for this category.'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Commission Tab */}
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
                <span className="text-sm font-medium">Example: KES 10,000 Booking</span>
                <span className="text-sm font-bold text-primary">-KES 1,500 Fee</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-primary/10">
                <span className="text-sm font-bold">Owner Receives</span>
                <span className="text-lg font-bold text-green-500">KES 8,500</span>
              </div>
            </div>
            <button className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:scale-[1.02] transition-transform shadow-lg shadow-primary/20">
              <Save size={18} /> Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Promotion Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-card w-full max-w-lg rounded-3xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30 sticky top-0 z-10">
              <h3 className="text-xl font-bold">{editingPromo ? 'Edit Promotion' : 'Create Promotion'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSavePromo} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="e.g. Weekend SUV Special"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  placeholder="Brief description of the promotion"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Discount Type</label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (KES)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Discount Value</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Target Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2.5 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c === 'all' ? 'All Categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Banner Text</label>
                <input
                  type="text"
                  value={formData.banner_text}
                  onChange={(e) => setFormData({ ...formData, banner_text: e.target.value })}
                  className="w-full px-4 py-2.5 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="e.g. 🔥 20% OFF all SUVs this weekend!"
                />
                <p className="text-[10px] text-muted-foreground">This text scrolls on the homepage banner</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Start Date</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-4 py-2.5 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">End Date</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-4 py-2.5 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:scale-[1.02] transition-transform shadow-lg shadow-primary/20"
                >
                  <Save size={18} /> {editingPromo ? 'Update' : 'Create'} Promotion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
