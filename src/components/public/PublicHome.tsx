import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { HeroSection } from './HeroSection';
import { CarShowroom } from './CarShowroom';
import { PromoBanner } from './PromoBanner';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star, BookOpen, Clock, Quote, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePublicImagesFinal } from '../../hooks/usePublicImagesFinal';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

export function PublicHome() {
  const { images, loading } = usePublicImagesFinal();
  const ctaImage = images.homepage_cta_image;
  const showImage = !loading && ctaImage;

  const [approvedReviews, setApprovedReviews] = useState<any[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [reviewDirection, setReviewDirection] = useState<'up' | 'down'>('up');
  const [featuredPost, setFeaturedPost] = useState<any>(null);

  useEffect(() => {
    supabase
      .from('car_reviews')
      .select('*, cars(make, model, year), bookings(start_date)')
      .eq('status', 'approved')
      .order('rating', { ascending: false })
      .limit(12)
      .then(async ({ data }) => {
        const reviews = data || [];
        const userIds = Array.from(new Set(reviews.map((r: any) => r.user_id).filter(Boolean)));
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, full_name')
            .in('id', userIds);
          const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
          reviews.forEach((r: any) => { r.user_profiles = profileMap.get(r.user_id) || null; });
        }
        setApprovedReviews(reviews);
      });

    supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, featured_image, category, published_at, read_time_minutes')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1)
      .then(({ data }) => setFeaturedPost(data?.[0] || null));
  }, []);

  useEffect(() => {
    if (approvedReviews.length <= 1) return;
    const timer = setInterval(() => {
      setReviewDirection('up');
      setActiveIdx(i => (i + 1) % approvedReviews.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [approvedReviews.length]);

  const goToReview = (dir: 'prev' | 'next') => {
    setReviewDirection(dir === 'next' ? 'up' : 'down');
    setActiveIdx(i => dir === 'next'
      ? (i + 1) % approvedReviews.length
      : (i - 1 + approvedReviews.length) % approvedReviews.length
    );
  };

  logger.log('PublicHome - Image loaded');

  return (
    <>
      <Helmet>
        <title>LinkedUp Cars Rentals | Car Hire Nairobi</title>
        <meta name="description" content="Book a car in Nairobi — self-drive, chauffeur, JKIA transfers and corporate transport. Instant online confirmation." />
        <link rel="canonical" href="https://linkedupcarsrentals.com/" />
        <meta property="og:title" content="LinkedUp Cars Rentals | Car Hire Nairobi" />
        <meta property="og:url" content="https://linkedupcarsrentals.com/" />
        <meta property="og:description" content="Book a car in Nairobi — self-drive, chauffeur, JKIA transfers and corporate transport. Instant online confirmation." />
      </Helmet>
      <div className="flex flex-col">
      <HeroSection />

      {/* Promo Banner - between hero and cars */}
      <PromoBanner />

      <CarShowroom isHome={true} showSearchControls={false} />

      {/* ── Rotating Reviews ─────────────────────────────────── */}
      {approvedReviews.length > 0 && (
        <section className="relative py-0 overflow-hidden">
          {/* Top fade — blends into CarShowroom background */}
          <div className="absolute top-0 left-0 right-0 h-24 md:h-32 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
          {/* Bottom fade — blends into CTA section */}
          <div className="absolute bottom-0 left-0 right-0 h-24 md:h-32 bg-gradient-to-t from-background via-background/80 to-transparent z-10 pointer-events-none" />

          {/* Ambient glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/3 to-background pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/8 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-20 py-16 md:py-24 px-6">
            {/* Label */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-8 md:mb-12"
            >
              <div className="flex items-center justify-center gap-2 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={16} className="text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-primary text-xs font-black uppercase tracking-[0.3em]">Verified Customer Reviews</p>
            </motion.div>

            {/* Card Carousel */}
            <div className="max-w-2xl mx-auto relative">
              <div className="relative min-h-[260px] md:min-h-[220px] flex items-center">
                <AnimatePresence mode="wait" custom={reviewDirection}>
                  <motion.div
                    key={activeIdx}
                    custom={reviewDirection}
                    variants={{
                      enter: (dir: string) => ({ opacity: 0, y: dir === 'up' ? 48 : -48 }),
                      center: { opacity: 1, y: 0 },
                      exit: (dir: string) => ({ opacity: 0, y: dir === 'up' ? -48 : 48 }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
                    className="w-full"
                  >
                    {(() => {
                      const review = approvedReviews[activeIdx];
                      const firstName = (review?.user_profiles?.full_name || 'A Customer').split(' ')[0];
                      const carName = review?.cars ? `${review.cars.make} ${review.cars.model} ${review.cars.year}` : 'LinkedUp Car';
                      const reviewDate = review?.created_at ? new Date(review.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
                      const bookingDate = review?.bookings?.start_date ? new Date(review.bookings.start_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
                      return (
                        <div className="relative bg-card/60 backdrop-blur-xl border border-primary/10 rounded-[28px] md:rounded-[36px] p-7 md:p-10 text-center shadow-2xl shadow-primary/5">
                          {/* Quote icon */}
                          <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                            <Quote size={14} className="text-white" />
                          </div>

                          {/* Stars */}
                          <div className="flex items-center justify-center gap-1 mb-5">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} size={18} className={i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-border'} />
                            ))}
                          </div>

                          {/* Comment */}
                          <p className="text-foreground text-base md:text-lg font-medium italic leading-relaxed mb-6">
                            &ldquo;{review.comment}&rdquo;
                          </p>

                          {/* Reviewer info */}
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 flex-wrap">
                            <div className="flex items-center gap-2">
                              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary font-black text-sm">
                                {firstName[0]}
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-bold text-foreground">{firstName}</p>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Verified Hire</p>
                              </div>
                            </div>

                            <div className="hidden sm:block w-px h-6 bg-border" />

                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <span className="text-primary font-bold">Car:</span> {carName}
                            </p>

                            {bookingDate && (
                              <>
                                <div className="hidden sm:block w-px h-6 bg-border" />
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-bold">Hired:</span> {bookingDate}
                                </p>
                              </>
                            )}

                            <div className="hidden sm:block w-px h-6 bg-border" />
                            <p className="text-xs text-muted-foreground">
                              <span className="font-bold">Reviewed:</span> {reviewDate}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Controls */}
              {approvedReviews.length > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8">
                  <button
                    onClick={() => goToReview('prev')}
                    className="w-10 h-10 rounded-full border border-border bg-card/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  {/* Dots */}
                  <div className="flex items-center gap-2">
                    {approvedReviews.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => { setReviewDirection(i > activeIdx ? 'up' : 'down'); setActiveIdx(i); }}
                        className={`transition-all rounded-full ${
                          i === activeIdx ? 'w-6 h-2 bg-primary' : 'w-2 h-2 bg-border hover:bg-primary/40'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => goToReview('next')}
                    className="w-10 h-10 rounded-full border border-border bg-card/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}

              {/* Counter */}
              <p className="text-center text-[11px] text-muted-foreground mt-4 font-bold">
                {activeIdx + 1} / {approvedReviews.length}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-24 md:py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background pointer-events-none" />
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-20 items-center relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-primary text-xs font-black uppercase tracking-[0.3em] mb-4 block">Ready to Drive?</span>
            <h2 className="text-4xl md:text-6xl font-serif font-black tracking-tighter italic text-foreground leading-tight mb-8">
              Your Perfect <span className="text-primary">Ride</span> is Just Three Steps Away
            </h2>

            {/* 4-Step Journey Display */}
            <div className="mb-10">
              {/* Desktop: Flex row with connectors */}
              <div className="hidden lg:flex flex-row items-center gap-2 flex-wrap">
                {[
                  { number: 'Step 1', label: 'Browse & Choose' },
                  { number: 'Step 2', label: 'Book Online' },
                  { number: 'Step 3', label: 'Pick Up & Drive' },
                  { number: '', label: 'Return & Review' }
                ].map((step, i) => (
                  <React.Fragment key={i}>
                    <div
                      className={`rounded-2xl px-4 py-3 bg-white/5 border border-orange-500/30 transition-all duration-300 hover:shadow-[0_0_28px_rgba(255,140,0,0.45)] hover:border-orange-400/60 cursor-pointer ${
                        i === 3 ? 'w-full max-w-[200px]' : ''
                      }`}
                    >
                      {step.number && (
                        <div className="text-orange-500 font-black text-xs tracking-widest uppercase mb-1">
                          {step.number}
                        </div>
                      )}
                      <div className="text-white font-serif italic font-semibold text-sm">
                        {step.label}
                      </div>
                    </div>
                    {i < 3 && (
                      <div className="w-8 h-0.5 relative overflow-hidden">
                        <div 
                          className="absolute inset-0"
                          style={{
                            background: 'linear-gradient(90deg, transparent, rgba(255,140,0,0.9), transparent)',
                            animation: 'shimmer 1.8s ease-in-out infinite'
                          }}
                        />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Mobile: 2x2 grid without connectors */}
              <div className="lg:hidden grid grid-cols-2 gap-3">
                {[
                  { number: 'Step 1', label: 'Browse & Choose' },
                  { number: 'Step 2', label: 'Book Online' },
                  { number: 'Step 3', label: 'Pick Up & Drive' },
                  { number: '', label: 'Return & Review' }
                ].map((step, i) => (
                  <div
                    key={i}
                    className="rounded-2xl px-4 py-3 bg-white/5 border border-orange-500/30 transition-all duration-300 hover:shadow-[0_0_28px_rgba(255,140,0,0.45)] hover:border-orange-400/60 cursor-pointer"
                  >
                    {step.number && (
                      <div className="text-orange-500 font-black text-xs tracking-widest uppercase mb-1">
                        {step.number}
                      </div>
                    )}
                    <div className="text-white font-serif italic font-semibold text-sm">
                      {step.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shimmer animation keyframes */}
            <style>{`
              @keyframes shimmer {
                0%, 100% { transform: translateX(-100%) }
                50% { transform: translateX(100%) }
              }
            `}</style>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/cars"
                className="px-8 py-4 bg-primary text-black rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl shadow-primary/20 group"
              >
                Browse Fleet
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/contact"
                className="px-8 py-4 border border-border text-foreground rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 hover:bg-card/50 transition-all"
              >
                Contact Us
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative aspect-[4/3] sm:aspect-square lg:aspect-[3/2] rounded-[20px] sm:rounded-[40px] lg:rounded-[60px] overflow-hidden border border-border bg-muted"
          >
            {showImage ? (
              <img
                src={ctaImage}
                alt="Drive with LinkedUp"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground text-sm">
                    {loading ? 'Loading image...' : 'No image set'}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── Featured Blog Article ─────────────────────────────── */}
      {featuredPost && (
        <section className="relative py-16 md:py-24 px-6 overflow-hidden">
          {/* Subtle border top */}
          <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative bg-card border border-border rounded-[32px] md:rounded-[48px] overflow-hidden"
            >
              {/* Inner glow */}
              <div className="absolute top-0 right-0 w-[400px] h-[300px] bg-primary/6 rounded-full blur-[80px] pointer-events-none" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                {/* Image — left on desktop, top on mobile */}
                {featuredPost.featured_image ? (
                  <div className="relative h-56 md:h-full min-h-[260px] overflow-hidden order-first md:order-first">
                    <img
                      src={featuredPost.featured_image}
                      alt={featuredPost.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-card/40 hidden md:block" />
                    <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent md:hidden" />
                  </div>
                ) : (
                  <div className="hidden md:flex items-center justify-center bg-primary/5 min-h-[260px]">
                    <BookOpen size={64} className="text-primary/20" />
                  </div>
                )}

                {/* Content — right on desktop */}
                <div className="relative z-10 p-8 md:p-12 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-5 flex-wrap">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[11px] font-bold uppercase tracking-widest">
                      {featuredPost.category}
                    </span>
                    <span className="text-muted-foreground text-xs flex items-center gap-1.5">
                      <Clock size={12} /> {featuredPost.read_time_minutes} min read
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(featuredPost.published_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  <p className="text-primary text-[11px] font-black uppercase tracking-[0.25em] mb-3 flex items-center gap-2">
                    <BookOpen size={12} /> Latest from Insights
                  </p>

                  <h3 className="text-2xl md:text-3xl lg:text-4xl font-serif font-black italic text-foreground leading-tight tracking-tighter mb-4">
                    {featuredPost.title}
                  </h3>

                  {featuredPost.excerpt && (
                    <p className="text-muted-foreground leading-relaxed text-sm md:text-base mb-8 line-clamp-3">
                      {featuredPost.excerpt}
                    </p>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      to={`/insights/${featuredPost.slug}`}
                      className="flex items-center justify-center gap-2 px-7 py-3.5 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary/90 hover:scale-[1.02] transition-all shadow-lg shadow-primary/20 group"
                    >
                      Read Full Article
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link
                      to="/insights"
                      className="flex items-center justify-center gap-2 px-7 py-3.5 border border-border rounded-2xl font-bold text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
                    >
                      <BookOpen size={15} />
                      View All Insights
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

    </div>
    </>
  );
}
