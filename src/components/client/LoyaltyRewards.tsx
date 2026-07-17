import React, { useEffect, useState } from 'react';
import { clientService } from '../../services/clientService';
import { supabase } from '../../lib/supabase';
import { 
  Award, 
  Gift, 
  Zap, 
  TrendingUp, 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  ChevronRight,
  Star,
  ShieldCheck,
  Crown,
  Gem
} from 'lucide-react';
import { motion } from 'motion/react';

const TIER_CONFIG: Record<string, any> = {
  'Bronze': {
    icon: Star,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50/30 dark:bg-orange-900/10',
    border: 'border-orange-200/50 dark:border-orange-800/30',
    next: 'Silver',
    target: 5,
    benefits: ['Standard Support', 'Standard Insurance', 'Access to Economy Fleet']
  },
  'Silver': {
    icon: ShieldCheck,
    color: 'text-slate-600 dark:text-slate-300',
    bg: 'bg-slate-100/30 dark:bg-slate-800/20',
    border: 'border-slate-200/50 dark:border-slate-700/30',
    next: 'Gold',
    target: 15,
    benefits: ['5% Discount on all rentals', 'Priority Support', 'Access to Premium Fleet', 'Free Additional Driver']
  },
  'Gold': {
    icon: Crown,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50/30 dark:bg-yellow-900/10',
    border: 'border-yellow-200/50 dark:border-yellow-800/30',
    next: 'Platinum',
    target: 30,
    benefits: ['10% Discount on all rentals', 'VIP Support', 'Access to Luxury Fleet', 'Complimentary Car Wash', 'Free Airport Delivery']
  },
  'Platinum': {
    icon: Gem,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50/30 dark:bg-purple-900/10',
    border: 'border-purple-200/50 dark:border-purple-800/30',
    next: null,
    target: 100,
    benefits: ['15% Discount on all rentals', 'Personal Concierge', 'Unlimited Miles', 'Guaranteed Availability', 'Complimentary Chauffeur (4h/rental)']
  }
};

export function LoyaltyRewards() {
  const [status, setStatus] = useState<any>(null);
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [exclusiveOffers, setExclusiveOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [loyalty, promos, offers] = await Promise.all([
          clientService.getLoyaltyStatus(user.id),
          clientService.getPromoCodes(),
          clientService.getExclusiveOffers()
        ]);
        setStatus(loyalty);
        setPromoCodes(promos || []);
        setExclusiveOffers(offers || []);
      }
    } catch (err) {
      console.error("Error fetching loyalty data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) return <div className="p-8">Loading Rewards...</div>;

  const currentTier = status?.loyalty_tier || 'Bronze';
  const tierInfo = TIER_CONFIG[currentTier];
  const progress = Math.min(100, (status?.completed_bookings / tierInfo.target) * 100);
  const remaining = Math.max(0, tierInfo.target - status?.completed_bookings);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Loyalty & Rewards</h2>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl font-bold text-sm">
          <Gift size={18} />
          <span>{status?.referral_credits || 0} Credits</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tier Status Card */}
        <div className="lg:col-span-2 space-y-6">
          <section className={`p-8 rounded-3xl border ${tierInfo.border} bg-card relative overflow-hidden shadow-sm transition-colors`}>
            <div className={`absolute inset-0 ${tierInfo.bg} transition-colors`} />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-16 h-16 rounded-2xl bg-card border ${tierInfo.border} flex items-center justify-center shadow-sm transition-colors`}>
                  <tierInfo.icon className={tierInfo.color} size={32} />
                </div>
                <div>
                  <p className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em] text-foreground">Current Status</p>
                  <h3 className={`text-3xl font-black ${tierInfo.color} tracking-tight`}>{currentTier} Member</h3>
                </div>
              </div>

              {tierInfo.next && (
                <div className="space-y-3 mb-8">
                  <div className="flex justify-between items-end text-sm">
                    <span className="font-bold opacity-60 text-foreground">Progress to {tierInfo.next}</span>
                    <span className="font-black text-foreground">{status?.completed_bookings || 0} / {tierInfo.target} Bookings</span>
                  </div>
                  <div className="h-3 bg-muted/50 rounded-full overflow-hidden border border-border/50">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full bg-gradient-to-r from-primary to-primary/60 rounded-full`}
                    />
                  </div>
                  <p className="text-xs font-medium opacity-60 italic text-foreground">
                    Just {remaining} more completed bookings to reach {tierInfo.next}!
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="text-sm font-bold opacity-60 uppercase tracking-wider">Your Benefits</h4>
                  <ul className="space-y-2">
                    {tierInfo.benefits.map((benefit: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-sm font-medium">
                        <CheckCircle2 size={16} className="text-green-500" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
                {tierInfo.next && (
                  <div className="space-y-3 opacity-50">
                    <h4 className="text-sm font-bold uppercase tracking-wider">Coming at {tierInfo.next}</h4>
                    <ul className="space-y-2">
                      {TIER_CONFIG[tierInfo.next].benefits.slice(0, 3).map((benefit: string, i: number) => (
                        <li key={i} className="flex items-center gap-2 text-sm font-medium">
                          <Star size={14} />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            {/* Background Decoration */}
            <tierInfo.icon className={`absolute -right-8 -bottom-8 opacity-5 rotate-12`} size={240} />
          </section>

          {/* Promo Code Wallet */}
          <section className="bg-card p-6 rounded-3xl border border-border shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Award className="text-primary" size={20} />
                <h3 className="text-lg font-bold">Promo Code Wallet</h3>
              </div>
              <span className="text-xs text-muted-foreground">{promoCodes.length} Available</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {promoCodes.length > 0 ? (
                promoCodes.map((promo) => (
                  <div key={promo.id} className="p-4 border border-dashed border-border rounded-2xl bg-muted/30 flex items-center justify-between group hover:border-primary/50 transition-colors">
                    <div>
                      <p className="text-xs font-bold text-primary mb-1">{promo.discount_value}{promo.discount_type === 'percentage' ? '%' : ' KES'} OFF</p>
                      <p className="font-black text-lg tracking-widest uppercase">{promo.code}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Expires: {new Date(promo.expiry_date).toLocaleDateString()}</p>
                    </div>
                    <button 
                      onClick={() => handleCopyCode(promo.code)}
                      className={`p-3 rounded-xl transition-all ${
                        copiedCode === promo.code ? 'bg-green-500 text-white' : 'bg-card text-muted-foreground hover:text-primary hover:bg-muted'
                      }`}
                    >
                      {copiedCode === promo.code ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-2 py-12 text-center text-muted-foreground">
                  <Gift size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No active promo codes in your wallet.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar: Exclusive Offers & Credits */}
        <div className="space-y-8">
          {/* Earned Credits */}
          <section className="bg-primary text-primary-foreground p-6 rounded-3xl shadow-xl shadow-primary/20 relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-lg font-bold mb-2">Refer-a-Friend</h3>
              <p className="text-xs opacity-80 mb-6">Earn 500 KES for every friend who completes their first rental.</p>
              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10 mb-6">
                <p className="text-[10px] uppercase font-bold opacity-60 mb-1">Your Referral Code</p>
                <div className="flex items-center justify-between">
                  <span className="font-black text-xl tracking-widest uppercase">DRIVE{status?.id?.slice(0, 4)}</span>
                  <button
                    onClick={() => handleCopyCode(`DRIVE${status?.id?.slice(0, 4)}`)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    aria-label="Copy referral code"
                  >
                    {copiedCode === `DRIVE${status?.id?.slice(0, 4)}` ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
              <button
                onClick={async () => {
                  const code = `DRIVE${status?.id?.slice(0, 4)}`;
                  const url = `${window.location.origin}/signup?ref=${code}`;
                  const text = `Use my code ${code} to get a discount on your first rental: ${url}`;
                  if (navigator.share) {
                    try { await navigator.share({ title: 'Join me on LinkedUp', text, url }); } catch {}
                  } else {
                    navigator.clipboard.writeText(text);
                    setCopiedCode('invite');
                    setTimeout(() => setCopiedCode(null), 2000);
                  }
                }}
                className="w-full py-3 bg-white text-primary rounded-xl font-bold text-sm hover:bg-white/90 transition-colors"
              >
                {copiedCode === 'invite' ? 'Invite Link Copied!' : 'Invite Friends'}
              </button>
            </div>
            <TrendingUp className="absolute -right-4 -bottom-4 opacity-10" size={120} />
          </section>

          {/* Exclusive Offers */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <Zap className="text-primary" size={18} /> Exclusive Offers
              </h3>
            </div>
            <div className="space-y-4">
              {exclusiveOffers.length > 0 ? (
                exclusiveOffers.map((offer) => (
                  <div key={offer.id} className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md transition-all">
                    {offer.image_url && (
                      <div className="h-32 overflow-hidden">
                        <img 
                          src={offer.image_url} 
                          alt={offer.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-150"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <span className="text-[10px] font-bold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-full">
                        {offer.min_tier} Exclusive
                      </span>
                      <h4 className="font-bold text-sm mt-2">{offer.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{offer.description}</p>
                      <button className="w-full mt-4 flex items-center justify-center gap-2 py-2 bg-muted hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-all">
                        View Offer <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center bg-muted/30 rounded-2xl border border-dashed border-border text-muted-foreground">
                  <p className="text-xs">No exclusive offers available for your tier yet.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
