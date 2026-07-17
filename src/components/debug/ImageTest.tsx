// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export function ImageTest() {
  const [testResults, setTestResults] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const runTests = async () => {
      const results: any = {};

      // Test 1: Basic Supabase connection
      try {
        const { data, error } = await supabase.from('app_settings').select('key, value').limit(1);
        results.supabaseConnection = {
          success: !error,
          data: data?.length || 0,
          error: error?.message
        };
      } catch (e: any) {
        results.supabaseConnection = {
          success: false,
          error: e.message
        };
      }

      // Test 2: Image settings
      try {
        const imageKeys = ['homepage_cta_image', 'about_hero_image', 'about_team_image', 'about_mission_image'];
        const { data, error } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', imageKeys);
        
        const images: any = {};
        data?.forEach(setting => {
          images[setting.key] = setting.value;
        });

        results.imageSettings = {
          success: !error,
          count: data?.length || 0,
          images,
          error: error?.message
        };
      } catch (e: any) {
        results.imageSettings = {
          success: false,
          error: e.message
        };
      }

      // Test 3: Check if images exist
      if (results.imageSettings?.success && results.imageSettings.images) {
        const imageTests: any = {};
        for (const [key, url] of Object.entries(results.imageSettings.images)) {
          if (url && typeof url === 'string') {
            try {
              const response = await fetch(url, { method: 'HEAD' });
              imageTests[key] = {
                exists: response.ok,
                status: response.status,
                url
              };
            } catch (e: any) {
              imageTests[key] = {
                exists: false,
                error: e.message,
                url
              };
            }
          } else {
            imageTests[key] = {
              exists: false,
              reason: 'No URL set',
              url
            };
          }
        }
        results.imageExistence = imageTests;
      }

      setTestResults(results);
      setLoading(false);
    };

    runTests();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Testing Image Loading...</h1>
        <div className="animate-pulse">Running tests...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Image Loading Debug Results</h1>
      
      <div className="space-y-6">
        {/* Supabase Connection */}
        <div className={`p-4 rounded-lg ${testResults.supabaseConnection?.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
          <h2 className="text-xl font-semibold mb-2">Supabase Connection</h2>
          <div className="text-sm">
            <p><strong>Status:</strong> {testResults.supabaseConnection?.success ? 'Connected' : 'Failed'}</p>
            <p><strong>Records Found:</strong> {testResults.supabaseConnection?.data || 0}</p>
            {testResults.supabaseConnection?.error && (
              <p className="text-red-600"><strong>Error:</strong> {testResults.supabaseConnection.error}</p>
            )}
          </div>
        </div>

        {/* Image Settings */}
        <div className={`p-4 rounded-lg ${testResults.imageSettings?.success ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border`}>
          <h2 className="text-xl font-semibold mb-2">Image Settings</h2>
          <div className="text-sm">
            <p><strong>Status:</strong> {testResults.imageSettings?.success ? 'Loaded' : 'Failed'}</p>
            <p><strong>Image Settings Found:</strong> {testResults.imageSettings?.count || 0}</p>
            {testResults.imageSettings?.error && (
              <p className="text-red-600"><strong>Error:</strong> {testResults.imageSettings.error}</p>
            )}
          </div>
          
          {testResults.imageSettings?.images && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Current Image URLs:</h3>
              <div className="space-y-2">
                {Object.entries(testResults.imageSettings.images).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <strong>{key}:</strong> {value || 'Not set'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Image Existence Tests */}
        {testResults.imageExistence && (
          <div className="p-4 rounded-lg bg-blue-50 border-blue-200 border">
            <h2 className="text-xl font-semibold mb-2">Image Existence Tests</h2>
            <div className="space-y-2">
              {Object.entries(testResults.imageExistence).map(([key, test]: [string, any]) => (
                <div key={key} className="text-sm">
                  <p><strong>{key}:</strong> 
                    <span className={test.exists ? 'text-green-600' : 'text-red-600'}>
                      {test.exists ? ' Exists' : ' Not Found'}
                    </span>
                    {!test.exists && test.reason && ` (${test.reason})`}
                  </p>
                  {test.url && (
                    <p className="text-xs text-gray-600 ml-4">URL: {test.url}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="p-4 rounded-lg bg-gray-50 border-gray-200 border">
          <h2 className="text-xl font-semibold mb-2">Next Steps</h2>
          <div className="text-sm space-y-2">
            <p>1. If Supabase connection failed, check your credentials</p>
            <p>2. If image settings are empty, upload images via Admin Settings</p>
            <p>3. If images don't exist, check the URLs in the database</p>
            <p>4. Check the browser console for additional error messages</p>
          </div>
        </div>
      </div>
    </div>
  );
}