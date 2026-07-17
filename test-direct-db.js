// Direct database test to check if images are saved
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://edroffvtzrowpsooszqh.supabase.co';
const supabaseKey = 'sb_publishable_kHHCZxwXi3vC9WAtSdmnCQ_j1rLgKRS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDatabase() {
  console.log('Testing direct database connection...');
  
  try {
    // Test 1: Check if we can read any settings
    const { data: allSettings, error: allError } = await supabase
      .from('app_settings')
      .select('*')
      .limit(10);
    
    console.log('All settings:', allSettings);
    console.log('All settings error:', allError);
    
    // Test 2: Check specifically for homepage_cta_image
    const { data: ctaData, error: ctaError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', 'homepage_cta_image')
      .single();
    
    console.log('CTA data:', ctaData);
    console.log('CTA error:', ctaError);
    
    // Test 3: Check all image keys
    const imageKeys = ['homepage_cta_image', 'about_hero_image', 'about_team_image', 'about_mission_image'];
    const { data: imageData, error: imageError } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', imageKeys);
    
    console.log('Image data:', imageData);
    console.log('Image error:', imageError);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testDatabase();
