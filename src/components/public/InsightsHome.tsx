import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { analyticsService } from '../../services/analyticsService';

import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { Clock, ArrowRight, Search, Tag } from 'lucide-react';
import { LogoLoader } from '../shared/LogoLoader';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  featured_image: string | null;
  category: string;
  published_at: string;
  read_time_minutes: number;
  views: number;
}

const CATEGORIES = ['All', 'Safari Tips', 'City Guides', 'Car Reviews', 'Behind the Scenes', 'Travel Tips', 'Corporate', 'Announcements'];

export function InsightsHome() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    const fetchPosts = async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, featured_image, category, published_at, read_time_minutes, views')
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      setPosts(data || []);
      setLoading(false);
    };
    fetchPosts();
  }, []);

  const filtered = posts.filter(p => {
    const matchCat = activeCategory === 'All' || p.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch = !q || p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const featured = filtered[0];
  const rest = filtered.slice(1);

  if (loading) return <LogoLoader fullScreen message="Loading insights..." />;

  return (
    <>
      <Helmet>
        <title>Insights | Car Hire Tips, Nairobi Guides & Travel Stories — LinkedUp Cars</title>
        <meta name="description" content="Real stories, travel guides, game drive tips and car hire insights from Nairobi's premier car rental company. No fluff, just value." />
        <link rel="canonical" href="https://linkedupcarsrentals.com/insights" />
        <meta property="og:title" content="Insights | LinkedUp Cars Rentals" />
        <meta property="og:url" content="https://linkedupcarsrentals.com/insights" />
      </Helmet>

      <div className="pt-32 pb-20">
        {/* Hero */}
        <section className="px-6 mb-16">
          <div className="max-w-5xl mx-auto">
            <motion.span initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-primary text-xs font-black uppercase tracking-[0.3em] mb-4 block">
              Stories from Nairobi's Roads
            </motion.span>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-5xl md:text-7xl font-serif font-black italic text-foreground tracking-tighter leading-tight">
                Insights
              </motion.h1>
              <div className="relative max-w-xs w-full">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search articles..."
                  className="w-full pl-9 pr-4 py-3 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Category pills */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                    activeCategory === cat
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'bg-card border border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </section>

        {posts.length === 0 ? (
          <section className="px-6">
            <div className="max-w-5xl mx-auto text-center py-20">
              <p className="text-muted-foreground text-lg">No articles published yet. Check back soon.</p>
            </div>
          </section>
        ) : filtered.length === 0 ? (
          <section className="px-6">
            <div className="max-w-5xl mx-auto text-center py-20">
              <p className="text-muted-foreground">No articles match your search.</p>
              <button onClick={() => { setSearch(''); setActiveCategory('All'); }} className="mt-3 text-primary font-bold text-sm hover:underline">
                Clear filters
              </button>
            </div>
          </section>
        ) : (
          <>
            {/* Featured Post */}
            {featured && (
              <section className="px-6 mb-16">
                <div className="max-w-5xl mx-auto">
                  <Link to={`/insights/${featured.slug}`}>
                    <motion.article
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group relative rounded-[32px] overflow-hidden bg-card border border-border hover:border-primary/30 transition-all"
                    >
                      {featured.featured_image ? (
                        <div className="relative h-64 md:h-80 overflow-hidden">
                          <img src={featured.featured_image} alt={featured.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                          <div className="absolute bottom-0 left-0 p-8">
                            <div className="flex items-center gap-3 mb-3">
                              <span className="px-3 py-1 bg-primary text-white rounded-full text-xs font-bold">{featured.category}</span>
                              <span className="text-white/70 text-xs flex items-center gap-1"><Clock size={11} /> {featured.read_time_minutes} min read</span>
                            </div>
                            <h2 className="text-2xl md:text-3xl font-serif font-black italic text-white leading-tight mb-2">{featured.title}</h2>
                            <p className="text-white/70 text-sm line-clamp-2 max-w-xl">{featured.excerpt}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 md:p-12">
                          <div className="flex items-center gap-3 mb-4">
                            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold">{featured.category}</span>
                            <span className="text-muted-foreground text-xs flex items-center gap-1"><Clock size={11} /> {featured.read_time_minutes} min read</span>
                          </div>
                          <h2 className="text-2xl md:text-4xl font-serif font-black italic text-foreground leading-tight mb-4">{featured.title}</h2>
                          <p className="text-muted-foreground leading-relaxed max-w-2xl">{featured.excerpt}</p>
                        </div>
                      )}
                      <div className="px-8 py-5 flex items-center justify-between border-t border-border">
                        <span className="text-xs text-muted-foreground">{new Date(featured.published_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        <span className="flex items-center gap-2 text-primary font-bold text-sm group-hover:gap-3 transition-all">
                          Read Article <ArrowRight size={16} />
                        </span>
                      </div>
                    </motion.article>
                  </Link>
                </div>
              </section>
            )}

            {/* Grid */}
            {rest.length > 0 && (
              <section className="px-6">
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rest.map((post, i) => (
                    <Link key={post.id} to={`/insights/${post.slug}`}>
                      <motion.article
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.05 }}
                        className="group h-full bg-card border border-border rounded-[24px] overflow-hidden hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-primary/5"
                      >
                        {post.featured_image && (
                          <div className="h-44 overflow-hidden">
                            <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-150" />
                          </div>
                        )}
                        <div className="p-6">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold uppercase tracking-wider">{post.category}</span>
                            <span className="text-muted-foreground text-[11px] flex items-center gap-1"><Clock size={10} /> {post.read_time_minutes} min</span>
                          </div>
                          <h3 className="font-serif font-black italic text-foreground text-lg leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">{post.title}</h3>
                          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 mb-4">{post.excerpt}</p>
                          <div className="flex items-center justify-between pt-4 border-t border-border">
                            <span className="text-xs text-muted-foreground">{new Date(post.published_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            <span className="text-primary font-bold text-xs flex items-center gap-1 group-hover:gap-2 transition-all">Read <ArrowRight size={12} /></span>
                          </div>
                        </div>
                      </motion.article>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
