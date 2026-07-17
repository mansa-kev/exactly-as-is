import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Edit2, Trash2, Eye, Search, Filter,
  BookOpen, Calendar, Tag, ArrowLeft, Save,
  Upload, Globe, FileText, Clock, TrendingUp,
  X, CheckCircle2, Archive
} from 'lucide-react';
import { LogoLoader } from '../shared/LogoLoader';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image: string | null;
  category: string;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  keywords: string | null;
  read_time_minutes: number;
  views: number;
  created_at: string;
}

const CATEGORIES = [
  'General', 'Safari Tips', 'City Guides', 'Car Reviews',
  'Behind the Scenes', 'Travel Tips', 'Corporate', 'Announcements'
];

const EMPTY_POST: Omit<BlogPost, 'id' | 'views' | 'created_at'> = {
  title: '', slug: '', excerpt: '', content: '',
  featured_image: null, category: 'General', status: 'draft',
  published_at: null, meta_title: null, meta_description: null,
  keywords: null, read_time_minutes: 3,
};

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function estimateReadTime(content: string) {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

// ── Editor ────────────────────────────────────────────────
function BlogEditor({ post, onSave, onBack }: {
  post: Partial<BlogPost> | null;
  onSave: () => void;
  onBack: () => void;
}) {
  const isNew = !post?.id;
  const [form, setForm] = useState({
    title: post?.title ?? '',
    slug: post?.slug ?? '',
    excerpt: post?.excerpt ?? '',
    content: post?.content ?? '',
    featured_image: post?.featured_image ?? '',
    category: post?.category ?? 'General',
    status: post?.status ?? 'draft' as 'draft' | 'published' | 'archived',
    meta_title: post?.meta_title ?? '',
    meta_description: post?.meta_description ?? '',
    keywords: post?.keywords ?? '',
    read_time_minutes: post?.read_time_minutes ?? 3,
  });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'content' | 'seo'>('content');
  const [imageUploading, setImageUploading] = useState(false);

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const handleTitleChange = (val: string) => {
    set('title', val);
    if (isNew) set('slug', slugify(val));
  };

  const handleContentChange = (val: string) => {
    set('content', val);
    set('read_time_minutes', estimateReadTime(val));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `blog/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('public_assets').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('public_assets').getPublicUrl(path);
      set('featured_image', publicUrl);
      toast.success('Image uploaded');
    } catch (err: any) {
      toast.error('Image upload failed: ' + err.message);
    } finally {
      setImageUploading(false);
    }
  };

  const handleSave = async (publishNow = false) => {
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.slug.trim()) return toast.error('Slug is required');
    if (!form.content.trim()) return toast.error('Content is required');
    setSaving(true);
    try {
      const payload = {
        ...form,
        status: publishNow ? 'published' : form.status,
        published_at: publishNow ? new Date().toISOString() : (form.status === 'published' ? (post?.published_at ?? new Date().toISOString()) : null),
        meta_title: form.meta_title || form.title,
        meta_description: form.meta_description || form.excerpt,
      };
      if (isNew) {
        const { error } = await supabase.from('blog_posts').insert(payload);
        if (error) throw error;
        toast.success('Post created!');
      } else {
        const { error } = await supabase.from('blog_posts').update(payload).eq('id', post!.id);
        if (error) throw error;
        toast.success('Post saved!');
      }
      onSave();
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium">
          <ArrowLeft size={18} /> Back to Posts
        </button>
        <div className="flex items-center gap-3">
          <select
            value={form.status}
            onChange={e => set('status', e.target.value)}
            className="bg-card border border-border rounded-xl px-3 py-2 text-sm font-medium outline-none"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-sm font-bold hover:border-primary/30 transition-all disabled:opacity-50"
          >
            <Save size={16} /> Save Draft
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            <Globe size={16} /> Publish
          </button>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
        {(['content', 'seo'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === t ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t === 'content' ? 'Content' : 'SEO & Meta'}
          </button>
        ))}
      </div>

      {tab === 'content' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="xl:col-span-2 space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Title *</label>
              <input
                value={form.title}
                onChange={e => handleTitleChange(e.target.value)}
                placeholder="Write a compelling title..."
                className="w-full px-4 py-3 bg-card border border-border rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Slug</label>
              <input
                value={form.slug}
                onChange={e => set('slug', slugify(e.target.value))}
                className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <p className="text-xs text-muted-foreground mt-1">URL: linkedupcarsrentals.com/insights/{form.slug || '...'}</p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Excerpt</label>
              <textarea
                value={form.excerpt}
                onChange={e => set('excerpt', e.target.value)}
                rows={2}
                placeholder="Short compelling preview shown in listings..."
                className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Content *</label>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock size={12} /> ~{form.read_time_minutes} min read
                </span>
              </div>
              <textarea
                value={form.content}
                onChange={e => handleContentChange(e.target.value)}
                rows={20}
                placeholder="Write your article here...

Supports basic markdown:
# Heading 1
## Heading 2
**bold text**
*italic text*
- bullet point"
                className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-y"
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-bold text-sm mb-4">Featured Image</h3>
              {form.featured_image ? (
                <div className="relative">
                  <img src={form.featured_image} alt="Featured" className="w-full aspect-video object-cover rounded-xl mb-3" />
                  <button
                    onClick={() => set('featured_image', '')}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-white hover:bg-black/80"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/30 transition-colors">
                  {imageUploading ? (
                    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Upload size={24} className="text-muted-foreground mb-2" />
                      <span className="text-xs text-muted-foreground">Click to upload image</span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              )}
              <input
                value={form.featured_image ?? ''}
                onChange={e => set('featured_image', e.target.value)}
                placeholder="Or paste image URL..."
                className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-xs outline-none mt-2"
              />
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-bold text-sm mb-4">Category</h3>
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-sm outline-none"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h3 className="font-bold">SEO Meta Tags</h3>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Meta Title</label>
              <input
                value={form.meta_title ?? ''}
                onChange={e => set('meta_title', e.target.value)}
                placeholder={form.title || 'Meta title (defaults to post title)'}
                className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-muted-foreground mt-1">{(form.meta_title || form.title).length}/60 chars</p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Meta Description</label>
              <textarea
                value={form.meta_description ?? ''}
                onChange={e => set('meta_description', e.target.value)}
                rows={3}
                placeholder={form.excerpt || 'Meta description (defaults to excerpt)'}
                className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">{(form.meta_description || form.excerpt).length}/160 chars</p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">Keywords</label>
              <input
                value={form.keywords ?? ''}
                onChange={e => set('keywords', e.target.value)}
                placeholder="car hire Nairobi, JKIA transfer, self drive Kenya"
                className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* SEO Preview */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-bold text-sm mb-4">Google Preview</h3>
            <div className="space-y-1">
              <p className="text-xs text-green-600">linkedupcarsrentals.com/insights/{form.slug || 'your-slug'}</p>
              <p className="text-blue-400 text-lg font-medium leading-tight line-clamp-1">
                {form.meta_title || form.title || 'Your Post Title'}
              </p>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {form.meta_description || form.excerpt || 'Your meta description will appear here in Google search results.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main List View ─────────────────────────────────────────
export function AdminBlog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<Partial<BlogPost> | null | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPosts(data || []);
    } catch (err: any) {
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post permanently?')) return;
    setDeleting(id);
    try {
      const { error } = await supabase.from('blog_posts').delete().eq('id', id);
      if (error) throw error;
      toast.success('Post deleted');
      fetchPosts();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleStatus = async (post: BlogPost) => {
    const newStatus = post.status === 'published' ? 'draft' : 'published';
    try {
      const { error } = await supabase
        .from('blog_posts')
        .update({ status: newStatus, published_at: newStatus === 'published' ? new Date().toISOString() : null })
        .eq('id', post.id);
      if (error) throw error;
      toast.success(`Post ${newStatus}`);
      fetchPosts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filtered = posts.filter(p => {
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const stats = {
    total: posts.length,
    published: posts.filter(p => p.status === 'published').length,
    draft: posts.filter(p => p.status === 'draft').length,
    views: posts.reduce((sum, p) => sum + (p.views || 0), 0),
  };

  if (editingPost !== undefined) {
    return (
      <BlogEditor
        post={editingPost}
        onSave={() => { setEditingPost(undefined); fetchPosts(); }}
        onBack={() => setEditingPost(undefined)}
      />
    );
  }

  if (loading) return <LogoLoader message="Loading posts..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Blog & Insights</h1>
          <p className="text-muted-foreground text-sm">Manage articles published to the public website</p>
        </div>
        <button
          onClick={() => setEditingPost(null)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={18} /> New Post
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Posts', value: stats.total, icon: FileText, color: 'text-primary' },
          { label: 'Published', value: stats.published, icon: Globe, color: 'text-green-500' },
          { label: 'Drafts', value: stats.draft, icon: BookOpen, color: 'text-amber-500' },
          { label: 'Total Views', value: stats.views.toLocaleString(), icon: TrendingUp, color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{s.label}</span>
              <s.icon size={18} className={s.color} />
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search posts..."
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
          <Filter size={15} className="text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-transparent border-none text-sm font-medium outline-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Posts Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen size={48} className="text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-muted-foreground">
            {posts.length === 0 ? 'No posts yet. Write your first article!' : 'No posts match your filters.'}
          </p>
          {posts.length === 0 && (
            <button
              onClick={() => setEditingPost(null)}
              className="mt-4 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all"
            >
              Write First Post
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => (
            <motion.div
              key={post.id}
              layout
              className="bg-card border border-border rounded-2xl p-5 hover:border-primary/20 transition-all group"
            >
              <div className="flex items-start gap-4">
                {post.featured_image && (
                  <img
                    src={post.featured_image}
                    alt={post.title}
                    className="w-20 h-14 object-cover rounded-xl shrink-0 hidden md:block"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      post.status === 'published' ? 'bg-green-500/10 text-green-500' :
                      post.status === 'draft' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {post.status}
                    </span>
                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold">
                      {post.category}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock size={11} /> {post.read_time_minutes} min
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Eye size={11} /> {post.views} views
                    </span>
                  </div>
                  <h3 className="font-bold text-foreground text-base leading-tight mb-1 line-clamp-1">{post.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">{post.excerpt}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {post.published_at
                      ? `Published ${new Date(post.published_at).toLocaleDateString()}`
                      : `Created ${new Date(post.created_at).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {post.status === 'published' && (
                    <a
                      href={`https://linkedupcarsrentals.com/insights/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-primary/10 rounded-lg text-muted-foreground hover:text-primary transition-colors"
                      title="View live"
                    >
                      <Eye size={16} />
                    </a>
                  )}
                  <button
                    onClick={() => handleToggleStatus(post)}
                    className={`p-2 rounded-lg transition-colors ${
                      post.status === 'published'
                        ? 'hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500'
                        : 'hover:bg-green-500/10 text-muted-foreground hover:text-green-500'
                    }`}
                    title={post.status === 'published' ? 'Unpublish' : 'Publish'}
                  >
                    {post.status === 'published' ? <Archive size={16} /> : <Globe size={16} />}
                  </button>
                  <button
                    onClick={() => setEditingPost(post)}
                    className="p-2 hover:bg-primary/10 rounded-lg text-muted-foreground hover:text-primary transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(post.id)}
                    disabled={deleting === post.id}
                    className="p-2 hover:bg-error/10 rounded-lg text-muted-foreground hover:text-error transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
