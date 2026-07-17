// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { enhancedContractService } from '../../services/enhancedContractService';
import { supabase } from '../../lib/supabase';

export function ContractDebug() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const runDebug = async () => {
      console.log('🔍 Starting contract debug...');
      
      try {
        // Test 1: Check Supabase connection
        console.log('📡 Testing Supabase connection...');
        const { data: testData, error: testError } = await supabase
          .from('contracts_master')
          .select('count')
          .limit(1);
        
        console.log('📊 Supabase test result:', { testData, testError });

        // Test 2: Get all contracts
        console.log('🗂️ Fetching all contracts...');
        const { data: allContracts, error: allError } = await supabase
          .from('contracts_master')
          .select('*');
        
        console.log('📋 All contracts:', allContracts);
        console.log('❌ All contracts error:', allError);

        // Test 3: Get active contracts
        console.log('✅ Fetching active contracts...');
        const { data: activeContracts, error: activeError } = await supabase
          .from('contracts_master')
          .select('*')
          .eq('is_active', true);
        
        console.log('🎯 Active contracts:', activeContracts);
        console.log('❌ Active contracts error:', activeError);

        // Test 4: Use enhanced service
        console.log('🔧 Using enhanced contract service...');
        const contract = await enhancedContractService.getMasterContract();
        console.log('📄 Enhanced service result:', contract);

        // Test 5: Note if no active contract found
        if (!contract && (!activeContracts || activeContracts.length === 0)) {
          console.log('No active contracts found. Upload one via Admin Portal.');
        }

        setDebugInfo({
          supabaseTest: { testData, testError },
          allContracts: { data: allContracts, error: allError },
          activeContracts: { data: activeContracts, error: activeError },
          enhancedService: contract,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('💥 Debug error:', error);
        setDebugInfo({
          error: error.message,
          timestamp: new Date().toISOString()
        });
      } finally {
        setLoading(false);
      }
    };

    runDebug();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">🔍 Contract Debug</h1>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Running diagnostics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🔍 Contract Debug Results</h1>
      
      <div className="space-y-4">
        <div className="bg-gray-100 rounded-lg p-4">
          <h2 className="font-semibold mb-2">📡 Supabase Connection Test</h2>
          <pre className="text-xs bg-white p-2 rounded overflow-auto">
            {JSON.stringify(debugInfo?.supabaseTest, null, 2)}
          </pre>
        </div>

        <div className="bg-gray-100 rounded-lg p-4">
          <h2 className="font-semibold mb-2">🗂️ All Contracts</h2>
          <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-64">
            {JSON.stringify(debugInfo?.allContracts, null, 2)}
          </pre>
        </div>

        <div className="bg-gray-100 rounded-lg p-4">
          <h2 className="font-semibold mb-2">✅ Active Contracts</h2>
          <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-64">
            {JSON.stringify(debugInfo?.activeContracts, null, 2)}
          </pre>
        </div>

        <div className="bg-gray-100 rounded-lg p-4">
          <h2 className="font-semibold mb-2">🔧 Enhanced Service Result</h2>
          <pre className="text-xs bg-white p-2 rounded overflow-auto">
            {JSON.stringify(debugInfo?.enhancedService, null, 2)}
          </pre>
        </div>

        {debugInfo?.error && (
          <div className="bg-red-100 rounded-lg p-4">
            <h2 className="font-semibold mb-2 text-red-600">❌ Error</h2>
            <pre className="text-xs bg-white p-2 rounded text-red-600">
              {debugInfo.error}
            </pre>
          </div>
        )}

        <div className="text-xs text-gray-500 mt-4">
          Debug completed at: {debugInfo?.timestamp}
        </div>
      </div>
    </div>
  );
}