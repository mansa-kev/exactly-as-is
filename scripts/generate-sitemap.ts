// Generates public/sitemap.xml at predev/prebuild time.
// Pulls dynamic routes (/cars/:id, /vehicles/:slug, /models/:id) from Supabase.

import { writeFileSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = 'https://linkedupcarsrentals.com';
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://edroffvtzrowpsooszqh.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_kHHCZxwXi3vC9WAtSdmnCQ_j1rLgKRS';

interface Entry {
  path: string;
  changefreq?: string;
  priority?: string;
  lastmod?: string;
}

const staticEntries: Entry[] = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/cars', changefreq: 'daily', priority: '0.9' },
  { path: '/about', changefreq: 'monthly', priority: '0.7' },
  { path: '/contact', changefreq: 'monthly', priority: '0.7' },
  { path: '/how-it-works', changefreq: 'monthly', priority: '0.6' },
  { path: '/faq', changefreq: 'monthly', priority: '0.7' },
  { path: '/insights', changefreq: 'weekly', priority: '0.8' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
];

async function fetchRows<T>(table: string, select: string): Promise<T[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=1000`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
    );
    if (!res.ok) return [];
    return (await res.json()) as T[];
  } catch {
    return [];
  }
}

async function main() {
  const cars = await fetchRows<{ id: string }>('cars', 'id');
  const models = await fetchRows<{ id: string; slug: string | null }>(
    'vehicle_models',
    'id,slug',
  );
  const posts = await fetchRows<{ slug: string }>('blog_posts', 'slug&status=eq.published');

  const dynamic: Entry[] = [
    ...cars.map((c) => ({
      path: `/cars/${c.id}`,
      changefreq: 'weekly',
      priority: '0.7',
    })),
    ...models
      .filter((m) => m.slug)
      .map((m) => ({
        path: `/vehicles/${m.slug}`,
        changefreq: 'weekly',
        priority: '0.7',
      })),
    ...models.map((m) => ({
      path: `/models/${m.id}`,
      changefreq: 'weekly',
      priority: '0.6',
    })),
    ...posts.map((p) => ({
      path: `/insights/${p.slug}`,
      changefreq: 'monthly',
      priority: '0.6',
    })),
  ];

  const all = [...staticEntries, ...dynamic];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...all.map((e) =>
      [
        '  <url>',
        `    <loc>${BASE_URL}${e.path}</loc>`,
        e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
        e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
        e.priority ? `    <priority>${e.priority}</priority>` : null,
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n'),
    ),
    '</urlset>',
  ].join('\n');

  writeFileSync(resolve('public/sitemap.xml'), xml);
  console.log(`sitemap.xml written (${all.length} entries)`);
}

main().catch((e) => {
  console.error('sitemap generation failed:', e);
  process.exit(0); // don't break the build
});
