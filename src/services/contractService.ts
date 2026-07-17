import { supabase, handleSupabaseErrorWrapper as handleSupabaseError } from '../lib/supabase';

export const contractService = {
  getMasterContract: async () => {
    try {
      const { data, error } = await supabase
        .from('contracts_master')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching master contract:', error);
      return null;
    }
  },

  generateContract: async (data: any) => {
    const masterContract = await contractService.getMasterContract();
    return masterContract?.pdf_url || masterContract?.contract_url || masterContract?.template_url || '';
  }
};
