import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ImageSettings {
  homepage_cta_image?: string;
  about_hero_image?: string;
  about_team_image?: string;
  about_mission_image?: string;
}

export function useImages() {
  const [images, setImages] = useState<ImageSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const imageKeys = ['homepage_cta_image', 'about_hero_image', 'about_team_image', 'about_mission_image'];
        
        const { data, error } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', imageKeys);

        if (error) throw error;

        const imageMap: ImageSettings = {};
        data?.forEach(setting => {
          if (setting.key in imageMap) {
            imageMap[setting.key as keyof ImageSettings] = setting.value;
          }
        });

        setImages(imageMap);
      } catch (error) {
        console.error('Failed to fetch images:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, []);

  return { images, loading };
}
