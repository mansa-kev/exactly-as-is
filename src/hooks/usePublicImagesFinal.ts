import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { toProxyUrl } from '../utils/imageProxy';
import { storage } from '../utils/storage';

interface ImageSettings {
  homepage_cta_image?: string;
  about_hero_image?: string;
  about_team_image?: string;
  about_mission_image?: string;
}

const STORAGE_KEY = 'linkedup_public_images';
const CACHE_VERSION = 'v1';

function buildProxiedData(imageMap: ImageSettings): ImageSettings {
  return {
    homepage_cta_image: imageMap.homepage_cta_image ? toProxyUrl(imageMap.homepage_cta_image) : undefined,
    about_hero_image: imageMap.about_hero_image ? toProxyUrl(imageMap.about_hero_image) : undefined,
    about_team_image: imageMap.about_team_image ? toProxyUrl(imageMap.about_team_image) : undefined,
    about_mission_image: imageMap.about_mission_image ? toProxyUrl(imageMap.about_mission_image) : undefined,
  };
}

function saveToCache(imageMap: ImageSettings) {
  storage.set(STORAGE_KEY, { version: CACHE_VERSION, data: imageMap, timestamp: Date.now() });
}

export function usePublicImagesFinal() {
  const [images, setImages] = useState<ImageSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        logger.log('usePublicImagesFinal - Starting fetch...');

        // Step 1: Load cache immediately for instant render (no flash)
        let hasCachedData = false;
        try {
          const cached = storage.get(STORAGE_KEY);
          if (cached) {
            const { version, data, timestamp } = cached;
            // Use cache if current version and less than 24 hours old
            if (version === CACHE_VERSION && Date.now() - timestamp < 24 * 60 * 60 * 1000) {
              logger.log('usePublicImagesFinal - Using cached images');
              setImages(buildProxiedData(data));
              setLoading(false);
              hasCachedData = true;
              // Continue to background-refresh fresh data
            }
          }
        } catch {
          logger.log('usePublicImagesFinal - Cache read failed');
        }

        // Step 2: Attempt live fetch — three approaches in order
        // None of these failures should ever destroy the cache

        // Approach 1: public_image_settings view (anon-safe after RLS fix)
        try {
          const { data: viewData, error: viewError } = await supabase
            .from('public_image_settings')
            .select('key, value');

          if (!viewError && viewData && viewData.length > 0) {
            const imageMap: ImageSettings = {};
            viewData.forEach(s => { imageMap[s.key as keyof ImageSettings] = s.value; });
            logger.log('usePublicImagesFinal - Success via public view');
            setImages(buildProxiedData(imageMap));
            saveToCache(imageMap);
            setLoading(false);
            return;
          }
        } catch {
          logger.log('usePublicImagesFinal - Public view unavailable');
        }

        // Approach 2: RPC function (anon-safe after RLS fix)
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_public_image_settings');

          if (!rpcError && rpcData && rpcData.length > 0) {
            const imageMap: ImageSettings = {};
            rpcData.forEach((s: any) => { imageMap[s.key as keyof ImageSettings] = s.value; });
            logger.log('usePublicImagesFinal - Success via RPC');
            setImages(buildProxiedData(imageMap));
            saveToCache(imageMap);
            setLoading(false);
            return;
          }
        } catch {
          logger.log('usePublicImagesFinal - RPC unavailable');
        }

        // Approach 3: Direct app_settings table (anon-safe after RLS fix)
        try {
          const { data: tableData, error: tableError } = await supabase
            .from('app_settings')
            .select('key, value')
            .in('key', ['homepage_cta_image', 'about_hero_image', 'about_team_image', 'about_mission_image']);

          if (!tableError && tableData && tableData.length > 0) {
            const imageMap: ImageSettings = {};
            tableData.forEach(s => { imageMap[s.key as keyof ImageSettings] = s.value; });
            logger.log('usePublicImagesFinal - Success via direct table');
            setImages(buildProxiedData(imageMap));
            saveToCache(imageMap);
            setLoading(false);
            return;
          }
        } catch {
          logger.log('usePublicImagesFinal - Direct table unavailable');
        }

        // All live fetches failed — cache is preserved, just stop loading
        // Do NOT clear cache here — could be an RLS or network issue
        if (!hasCachedData) {
          logger.warn('usePublicImagesFinal - All approaches failed, no cache available');
        } else {
          logger.log('usePublicImagesFinal - Live fetch failed, serving from cache');
        }

      } catch (error) {
        logger.error('usePublicImagesFinal - Unexpected error');
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, []);

  return { images, loading };
}
