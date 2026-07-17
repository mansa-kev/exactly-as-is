import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

interface ImageSettings {
  homepage_cta_image?: string;
  about_hero_image?: string;
  about_team_image?: string;
  about_mission_image?: string;
}

export function usePublicImagesWithFallback() {
  const [images, setImages] = useState<ImageSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        logger.log('usePublicImagesWithFallback - Starting fetch...');
        
        // Try multiple approaches to fetch images
        
        // Approach 1: Try direct public read
        const { data: data1, error: error1 } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['homepage_cta_image', 'about_hero_image', 'about_team_image', 'about_mission_image']);

        logger.log('usePublicImagesWithFallback - Approach 1 result:', { data1, error1 });

        if (!error1 && data1 && data1.length > 0) {
          const imageMap: ImageSettings = {};
          data1.forEach(setting => {
            imageMap[setting.key as keyof ImageSettings] = setting.value;
          });
          logger.log('usePublicImagesWithFallback - Success with approach 1:', imageMap);
          setImages(imageMap);
          setLoading(false);
          return;
        }

        // Approach 2: Try RPC function (if exists)
        try {
          const { data: data2, error: error2 } = await supabase.rpc('get_public_image_settings');
          logger.log('usePublicImagesWithFallback - Approach 2 (RPC) result:', { data2, error2 });
          
          if (!error2 && data2) {
            logger.log('usePublicImagesWithFallback - Success with approach 2:', data2);
            setImages(data2);
            setLoading(false);
            return;
          }
        } catch (rpcError) {
          logger.log('usePublicImagesWithFallback - RPC not available:', rpcError);
        }

        // Approach 3: Try a different query pattern
        const { data: data3, error: error3 } = await supabase
          .from('app_settings')
          .select('*')
          .or('key.eq.homepage_cta_image,key.eq.about_hero_image,key.eq.about_team_image,key.eq.about_mission_image');

        logger.log('usePublicImagesWithFallback - Approach 3 result:', { data3, error3 });

        if (!error3 && data3 && data3.length > 0) {
          const imageMap: ImageSettings = {};
          data3.forEach(setting => {
            imageMap[setting.key as keyof ImageSettings] = setting.value;
          });
          logger.log('usePublicImagesWithFallback - Success with approach 3:', imageMap);
          setImages(imageMap);
          setLoading(false);
          return;
        }

        // If all approaches fail, use fallbacks
        logger.warn('usePublicImagesWithFallback - All approaches failed, using fallbacks');
        setImages({});
        
      } catch (error) {
        logger.error('usePublicImagesWithFallback - Failed to fetch images:', error);
        setImages({});
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, []);

  return { images, loading };
}
