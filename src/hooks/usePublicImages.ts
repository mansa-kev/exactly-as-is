import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

interface ImageSettings {
  homepage_cta_image?: string;
  about_hero_image?: string;
  about_team_image?: string;
  about_mission_image?: string;
}

export function usePublicImages() {
  const [images, setImages] = useState<ImageSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        logger.log('usePublicImages - Starting fetch...');
        
        // Try to fetch images with a public approach
        const { data, error } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['homepage_cta_image', 'about_hero_image', 'about_team_image', 'about_mission_image']);

        logger.log('usePublicImages - Supabase response:', { data, error });

        if (error) {
          logger.warn('Could not fetch images from settings, using fallbacks:', error.message);
          // Set empty images to use fallbacks
          setImages({});
        } else {
          const imageMap: ImageSettings = {};
          data?.forEach(setting => {
            if (setting.key in imageMap) {
              imageMap[setting.key as keyof ImageSettings] = setting.value;
            }
          });
          logger.log('usePublicImages - Processed image map:', imageMap);
          setImages(imageMap);
        }
      } catch (error) {
        logger.error('Failed to fetch images:', error);
        setImages({});
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, []);

  return { images, loading };
}
