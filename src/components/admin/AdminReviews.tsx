import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { motion } from 'motion/react';
import {
  Star, Search, Trash2, CheckCircle2, XCircle,
  Car, Clock, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { LogoLoader } from '../shared/LogoLoader';

interface Review {
  id: string;
  car_id: string;
  booking_id: string;
  user_id: string;
  rating: number;
  comment: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  user_profiles: { full_name: string } | null;
  cars: { make: string; model: string; year: number } | null;
  vehicle_models: { make: string; model: string; year: number; display_name: string } | null;
}

type TabType = 'pending' | 'approved' | 'rejected';

export function AdminReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>('pending');
  const [search, setSearch] = useState('');

  const fetchReviews = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('car_reviews')
      .select('*, user_profiles(full_name), cars(make, model, year), bookings(vehicle_model_id, vehicle_models(make, model, year, display_name))')
      .order('created_at', { ascending: false });
    if (!error) setReviews((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchReviews(); }, []);

  const updateStatus = (id: string, status: 'approved' | 'rejected') => {
    const promise = new Promise<void>(async (resolve, reject) => {
      const { error } = await supabase.from('car_reviews')
        .update({ status, admin_reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) { reject(error); return; }
      await fetchReviews();
      resolve();
    });
    toast.promise(promise, {
      loading: status === 'approved' ? 'Approving review...' : 'Rejecting review...',
      success: status === 'approved' ? 'Review approved and live on site!' : 'Review rejected',
      error: 'Failed to update review',
    });
  };

  const deleteReview = async (id: string) => {
    if (!confirm('Delete this review permanently?')) return;
    const promise = new Promise<void>(async (resolve, reject) => {
      const { error } = await supabase.from('car_reviews').delete().eq('id', id);
      if (error) { reject(error); return; }
      await fetchReviews();
      resolve();
    });
    toast.promise(promise, { loading: 'Deleting...', success: 'Review deleted', error: 'Failed to delete' });
  };

  const counts = {
    pending: reviews.filter(r => r.status === 'pending').length,
    approved: reviews.filter(r => r.status === 'approved').length,
    rejected: reviews.filter(r => r.status === 'rejected').length,
  };

  const filtered = reviews.filter(r => {
    if (r.status !== tab) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    const name = r.user_profiles?.full_name?.toLowerCase() ?? '';
    const car = r.cars ? `${r.cars.make} ${r.cars.model}`.toLowerCase() : r.vehicle_models ? `${r.vehicle_models.make} ${r.vehicle_models.model}`.toLowerCase() : '';
    return name.includes(q) || car.includes(q) || r.comment.toLowerCase().includes(q);
  });

  if (loading) return <LogoLoader message="Loading reviews..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Customer Reviews</h1>
          <p className="text-muted-foreground text-sm">Approve reviews before they appear on car detail pages</p>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, car, comment..."
            className="pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 w-72"
          />
        </div>
      </div>

      {/* Stat Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'pending', label: 'Pending', color: 'amber' },
          { key: 'approved', label: 'Approved', color: 'green' },
          { key: 'rejected', label: 'Rejected', color: 'red' },
        ] as { key: TabType; label: string; color: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              tab === t.key
                ? t.key === 'pending' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                  : t.key === 'approved' ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                  : 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                : 'bg-card border border-border text-muted-foreground hover:border-primary/30'
            }`}
          >
            {t.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              tab === t.key ? 'bg-white/20' : 'bg-muted'
            }`}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Reviews List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <MessageSquare size={48} className="text-muted-foreground mx-auto mb-4 opacity-30" />
          <p className="text-muted-foreground">
            {tab === 'pending' ? 'No reviews awaiting approval.' : `No ${tab} reviews.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((review: any, idx) => {
            const firstName = (review.user_profiles?.full_name || 'Anonymous').split(' ')[0];
            const getCarName = (review: any) => {
              if (review.bookings?.vehicle_models) {
                const vm = review.bookings.vehicle_models;
                return vm.display_name || `${vm.make} ${vm.model}`;
              }
              if (review.cars) {
                return `${review.cars.make} ${review.cars.model}`;
              }
              return 'Unknown Vehicle';
            };
            const carName = getCarName(review);

            return (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={`bg-card border rounded-2xl p-6 transition-all ${
                  tab === 'pending' ? 'border-amber-500/20 hover:border-amber-500/40' :
                  tab === 'approved' ? 'border-green-500/10 hover:border-green-500/30' :
                  'border-red-500/10 hover:border-red-500/30'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start gap-5">
                  {/* Avatar & Info */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-lg shrink-0">
                      {firstName[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <span className="font-bold text-foreground">{firstName}</span>
                        <span className="text-muted-foreground text-xs flex items-center gap-1">
                          <Car size={11} /> {carName}
                        </span>
                        <span className="text-muted-foreground text-xs flex items-center gap-1">
                          <Clock size={11} />
                          {new Date(review.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {/* Stars */}
                      <div className="flex items-center gap-0.5 mb-3">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={15} className={i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-border'} />
                        ))}
                      </div>
                      {/* Comment */}
                      <p className="text-muted-foreground text-sm leading-relaxed italic">
                        "{review.comment}"
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 md:flex-col md:items-end">
                    {tab === 'pending' && (
                      <>
                        <button
                          onClick={() => updateStatus(review.id, 'approved')}
                          className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 rounded-xl text-xs font-bold hover:bg-green-500/20 transition-colors"
                        >
                          <CheckCircle2 size={14} /> Approve
                        </button>
                        <button
                          onClick={() => updateStatus(review.id, 'rejected')}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-xl text-xs font-bold hover:bg-red-500/20 transition-colors"
                        >
                          <XCircle size={14} /> Reject
                        </button>
                      </>
                    )}
                    {tab === 'approved' && (
                      <button
                        onClick={() => updateStatus(review.id, 'rejected')}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-500 rounded-xl text-xs font-bold hover:bg-amber-500/20 transition-colors"
                      >
                        <XCircle size={14} /> Revoke
                      </button>
                    )}
                    {tab === 'rejected' && (
                      <button
                        onClick={() => updateStatus(review.id, 'approved')}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 rounded-xl text-xs font-bold hover:bg-green-500/20 transition-colors"
                      >
                        <CheckCircle2 size={14} /> Approve
                      </button>
                    )}
                    <button
                      onClick={() => deleteReview(review.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-error/10 text-error rounded-xl text-xs font-bold hover:bg-error/20 transition-colors"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
