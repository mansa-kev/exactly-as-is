import { supabase } from '../lib/supabase';

export interface Promotion {
  id: string;
  title: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  category: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  banner_text: string;
  created_at: string;
  updated_at: string;
}

export const promotionService = {
  // Fetch all promotions (admin)
  getAll: async (): Promise<Promotion[]> => {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching promotions:', error);
      return [];
    }
    return data || [];
  },

  // Fetch active promotions (public)
  getActive: async (): Promise<Promotion[]> => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .lte('start_date', now)
      .gte('end_date', now)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching active promotions:', error);
      return [];
    }
    return data || [];
  },

  // Get applicable promotion for a car category
  getForCategory: async (category: string): Promise<Promotion | null> => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .lte('start_date', now)
      .gte('end_date', now)
      .or(`category.eq.all,category.ilike.${category}`)
      .order('discount_value', { ascending: false })
      .limit(1);
    if (error) {
      console.error('Error fetching promotion for category:', error);
      return null;
    }
    return data?.[0] || null;
  },

  // Calculate discounted price
  applyDiscount: (dailyRate: number, promo: Promotion): { original: number; discounted: number; savings: number } => {
    let discounted = dailyRate;
    if (promo.discount_type === 'percentage') {
      discounted = dailyRate * (1 - promo.discount_value / 100);
    } else {
      discounted = Math.max(0, dailyRate - promo.discount_value);
    }
    return {
      original: dailyRate,
      discounted: Math.round(discounted),
      savings: Math.round(dailyRate - discounted),
    };
  },

  // Admin: create promotion
  create: async (promo: Partial<Promotion>): Promise<Promotion | null> => {
    const { data, error } = await supabase
      .from('promotions')
      .insert([promo])
      .select()
      .single();
    if (error) {
      console.error('Error creating promotion:', error);
      throw error;
    }
    return data;
  },

  // Admin: update promotion
  update: async (id: string, promo: Partial<Promotion>): Promise<Promotion | null> => {
    const { data, error } = await supabase
      .from('promotions')
      .update({ ...promo, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('Error updating promotion:', error);
      throw error;
    }
    return data;
  },

  // Admin: delete promotion
  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('promotions')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting promotion:', error);
      throw error;
    }
    return true;
  },

  // Admin: toggle active
  toggleActive: async (id: string, isActive: boolean): Promise<void> => {
    const { error } = await supabase
      .from('promotions')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};
