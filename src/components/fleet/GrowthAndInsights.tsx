import React, { useEffect, useState } from 'react';
import { fleetService } from '../../services/fleetService';
import { supabase } from '../../lib/supabase';
import { TrendingUp, DollarSign, BarChart2, PlusCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function GrowthAndInsights() {
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log("Current user:", user);
      if (user) {
        const data = await fleetService.getGrowthInsights(user.id);
        console.log("Fetched insights data:", data);
        setInsights(data);
      } else {
        console.log("No user found");
        setInsights(null);
      }
    } catch (err) {
      console.error("Error fetching growth insights:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading insights...</div>;
  if (!insights) return (
    <div className="p-8 text-muted-foreground">
      Please log in to view your growth and optimization insights.
    </div>
  );

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Growth & Optimization Tools</h2>
      
      {/* Dynamic Pricing */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2"><DollarSign size={20} /> Dynamic Pricing Suggestions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.pricingSuggestions?.map((s: any) => (
            <div key={s.carId} className="bg-card p-6 rounded-2xl border border-border shadow-sm flex justify-between items-center">
              <div>
                <p className="font-semibold">{s.carName}</p>
                <p className="text-sm text-muted-foreground">Current: ${s.currentRate} | Suggested: ${s.suggestedRate}</p>
              </div>
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold">Apply</button>
            </div>
          ))}
        </div>
      </div>

      {/* Market Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2"><BarChart2 size={20} /> Market Insights</h3>
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={300}>
              <BarChart data={insights.marketInsights?.topQueries || []}>
                <XAxis dataKey="query" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2"><TrendingUp size={20} /> Under-supplied Categories</h3>
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm h-64 flex items-center">
            <p className="text-muted-foreground">{insights.marketInsights?.underSupplied || 'No market insights available.'}</p>
          </div>
        </div>
      </div>

      {/* Fleet Expansion */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2"><PlusCircle size={20} /> Fleet Expansion Recommendations</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {insights.expansionRecommendations?.map((r: any, i: number) => (
            <div key={i} className="bg-card p-6 rounded-2xl border border-border shadow-sm">
              <p className="font-semibold">{r.model}</p>
              <p className="text-sm text-muted-foreground">{r.reason}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
