// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { Clock, ArrowLeft, ArrowRight, Tag, Eye, Share2, BookOpen } from 'lucide-react';
import { LogoLoader } from '../shared/LogoLoader';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image: string | null;
  category: string;
  published_at: string;
  read_time_minutes: number;
  views: number;
  meta_title: string | null;
  meta_description: string | null;
}

function renderContent(content: string): React.ReactNode[] {
  const lines = content.split('\n');
  const result: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    const k = key++;
    if (!line.trim()) {
      result.push(<div key={k} className="h-4" />);
    } else if (line.startsWith('# ')) {
      result.push(<h2 key={k} className="text-3xl font-serif font-black italic text-foreground mt-10 mb-4 leading-tight">{line.slice(2)}</h2>);
    } else if (line.startsWith('## ')) {
      result.push(<h3 key={k} className="text-2xl font-serif font-black italic text-foreground mt-8 mb-3 leading-tight">{line.slice(3)}</h3>);
    } else if (line.startsWith('### ')) {
      result.push(<h4 key={k} className="text-xl font-bold text-foreground mt-6 mb-2">{line.slice(4)}</h4>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      result.push(
        <li key={k} className="flex items-start gap-2 text-muted-foreground leading-relaxed mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
          <span>{formatInline(line.slice(2))}</span>
        </li>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s/)?.[1] || '';
      result.push(
        <li key={k} className="flex items-start gap-3 text-muted-foreground leading-relaxed mb-2">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{num}</span>
          <span>{formatInline(line.replace(/^\d+\.\s/, ''))}</span>
        </li>
      );
    } else if (line.startsWith('> ')) {
      result.push(
        <blockquote key={k} className="border-l-4 border-primary pl-6 py-2 my-4 italic text-muted-foreground bg-primary/5 rounded-r-xl">
          {line.slice(2)}
        </blockquote>
      );
    } else if (line.startsWith('---')) {
      result.push(<hr key={k} className="border-border my-8" />);
    } else {
      result.push(<p key={k} className="text-muted-foreground leading-relaxed text-lg mb-0">{formatInline(line)}</p>);
    }
  }
  return result;
}

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-foreground font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono text-primary">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export function InsightsDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (error || !data) {
        navigate('/insights', { replace: true });
        return;
      }

      setPost(data);

      // Increment view count
      supabase.from('blog_posts').update({ views: (data.views || 0) + 1 }).eq('id', data.id).then(() => {});

      // Fetch related posts
      const { data: relatedData } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, featured_image, category, published_at, read_time_minutes, views')
        .eq('status', 'published')
        .eq('category', data.category)
        .neq('id', data.id)
        .limit(3);

      setRelated(relatedData || []);
      setLoading(false);
    };

    fetchPost();
  }, [slug, navigate]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: post?.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (loading) return <LogoLoader fullScreen message="Loading article..." />;
  if (!post) return null;

  const pageTitle = post.meta_title || post.title;
  const pageDesc = post.meta_description || post.excerpt;
  const pageImage = post.featured_image || 'https://linkedupcarsrentals.com/logo.png';

  return (
    <>
      <Helmet>
        <title>{pageTitle} | LinkedUp Cars Insights</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={`https://linkedupcarsrentals.com/insights/${post.slug}`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:image" content={pageImage} />
        <meta property="og:url" content={`https://linkedupcarsrentals.com/insights/${post.slug}`} />
        <meta property="og:type" content="article" />
        <meta property="article:published_time" content={post.published_at} />
        <meta property="article:section" content={post.category} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.excerpt,
            image: pageImage,
            datePublished: post.published_at,
            publisher: {
              '@type': 'Organization',
              name: 'LinkedUp Cars Rentals',
              url: 'https://linkedupcarsrentals.com',
            },
            mainEntityOfPage: `https://linkedupcarsrentals.com/insights/${post.slug}`,
          })}
        </script>
      </Helmet>

      <div className="pt-32 pb-20">
        {/* Back Nav */}
        <div className="px-6 mb-8">
          <div className="max-w-3xl mx-auto">
            <Link to="/insights" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium text-sm">
              <ArrowLeft size={16} /> Back to Insights
            </Link>
          </div>
        </div>

        {/* Hero */}
        <div className="px-6 mb-10">
          <div className="max-w-3xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-3 mb-5 flex-wrap">
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider">{post.category}</span>
                <span className="text-muted-foreground text-sm flex items-center gap-1"><Clock size={13} /> {post.read_time_minutes} min read</span>
                <span className="text-muted-foreground text-sm flex items-center gap-1"><Eye size={13} /> {post.views} views</span>
                <span className="text-muted-foreground text-sm">
                  {new Date(post.published_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>

              <h1 className="text-4xl md:text-6xl font-serif font-black italic text-foreground tracking-tighter leading-tight mb-6">
                {post.title}
              </h1>

              {post.excerpt && (
                <p className="text-xl text-muted-foreground leading-relaxed border-l-4 border-primary/30 pl-5">
                  {post.excerpt}
                </p>
              )}
            </motion.div>
          </div>
        </div>

        {/* Featured Image */}
        {post.featured_image && (
          <div className="px-6 mb-12">
            <div className="max-w-3xl mx-auto">
              <motion.img
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                src={post.featured_image}
                alt={post.title}
                className="w-full aspect-video object-cover rounded-[24px]"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <article className="px-6 mb-16">
          <div className="max-w-3xl mx-auto space-y-2">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              {renderContent(post.content)}
            </motion.div>
          </div>
        </article>

        {/* Share + Tags */}
        <div className="px-6 mb-16">
          <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4 py-6 border-t border-b border-border">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Tag size={15} /> {post.category}
            </span>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-5 py-2.5 bg-card border border-border rounded-xl text-sm font-bold hover:border-primary/30 transition-all"
            >
              <Share2 size={16} /> Share Article
            </button>
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 mb-16">
          <div className="max-w-3xl mx-auto">
            <div className="relative bg-card border border-border rounded-[32px] p-8 md:p-12 overflow-hidden text-center">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[200px] bg-primary/10 rounded-full blur-[60px] pointer-events-none" />
              <div className="relative z-10">
                <p className="text-primary text-xs font-black uppercase tracking-[0.3em] mb-3">Ready to ride?</p>
                <h3 className="text-3xl font-serif font-black italic text-foreground mb-4">Book Your Car Today</h3>
                <p className="text-muted-foreground mb-6">Instant confirmation, full fleet, M-Pesa accepted.</p>
                <Link
                  to="/cars"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  Browse Fleet <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Related Posts */}
        {related.length > 0 && (
          <div className="px-6">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl font-serif font-black italic text-foreground mb-6">More from {post.category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {related.map((rel, i) => (
                  <Link key={rel.id} to={`/insights/${rel.slug}`}>
                    <motion.article
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05 }}
                      className="group bg-card border border-border rounded-[20px] overflow-hidden hover:border-primary/30 transition-all"
                    >
                      {rel.featured_image && (
                        <div className="h-36 overflow-hidden">
                          <img src={rel.featured_image} alt={rel.title} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-150" />
                        </div>
                      )}
                      <div className="p-5">
                        <p className="text-xs font-bold text-primary mb-2 uppercase tracking-wider">{rel.category}</p>
                        <h4 className="font-serif font-black italic text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2">{rel.title}</h4>
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Clock size={10} /> {rel.read_time_minutes} min</p>
                      </div>
                    </motion.article>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}