import React, { useEffect, useState } from 'react';
import { fleetService } from '../../services/fleetService';
import { supabase } from '../../lib/supabase';
import { DollarSign, CreditCard, Clock, TrendingUp, FileText, Plus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function FinancialCenter() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log("User:", user);
        if (user) {
          // Fetch each independently to prevent one missing table (like payouts) from breaking the whole page
          const payoutsPromise = fleetService.getPayouts(user.id).catch(e => {
            console.warn("Failed to fetch payouts:", e);
            return [];
          });
          const bookingsPromise = fleetService.getBookingsForEarnings(user.id).catch(e => {
            console.warn("Failed to fetch bookings:", e);
            return [];
          });
          const expensesPromise = fleetService.getExpenses(user.id).catch(e => {
            console.warn("Failed to fetch expenses:", e);
            return [];
          });

          const [payouts, bookings, expenses] = await Promise.all([
            payoutsPromise,
            bookingsPromise,
            expensesPromise
          ]);
          
          console.log("Fetched data:", { payouts, bookings, expenses });
          
          setData({ 
            payouts: Array.isArray(payouts) ? payouts : [], 
            bookings: Array.isArray(bookings) ? bookings : [], 
            expenses: Array.isArray(expenses) ? expenses : [] 
          });
        } else {
          console.log("No user found");
          setData({ payouts: [], bookings: [], expenses: [] });
        }
      } catch (err: any) {
        console.error("Error fetching financial data:", err);
        setError(err.message || "An error occurred while fetching data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-8">Loading financial data...</div>;
  if (error) return <div className="p-8 text-error">Error: {error}</div>;
  if (!data) return <div className="p-8">No data available.</div>;

  const totalEarnings = data.bookings.reduce((sum: number, b: any) => sum + Number(b.total_amount), 0);
  const totalPayouts = data.payouts.filter((p: any) => p.status === 'processed').reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const pendingPayouts = data.payouts.filter((p: any) => p.status === 'pending').reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Financial & Payout Center</h2>
      
      {/* Payout Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <DollarSign className="text-primary mb-4" size={24} />
          <h3 className="text-muted-foreground text-sm font-bold uppercase tracking-wider">Total Earnings</h3>
          <p className="text-3xl font-bold mt-2">Ksh {totalEarnings.toLocaleString()}</p>
        </div>
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <CreditCard className="text-success mb-4" size={24} />
          <h3 className="text-muted-foreground text-sm font-bold uppercase tracking-wider">Total Payouts</h3>
          <p className="text-3xl font-bold mt-2">Ksh {totalPayouts.toLocaleString()}</p>
        </div>
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <Clock className="text-warning mb-4" size={24} />
          <h3 className="text-muted-foreground text-sm font-bold uppercase tracking-wider">Pending Balance</h3>
          <p className="text-3xl font-bold mt-2">Ksh {pendingPayouts.toLocaleString()}</p>
        </div>
      </div>

      {/* Earnings Chart */}
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
        <h3 className="text-xl font-bold mb-6">Earnings vs Payouts</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={300}>
            <LineChart data={data.bookings}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="start_date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `Ksh ${value}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                itemStyle={{ color: 'var(--foreground)' }}
                formatter={(value) => [`Ksh ${Number(value).toLocaleString()}`, 'Amount']}
              />
              <Line type="monotone" dataKey="total_amount" stroke="var(--primary)" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payout History Table */}
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
        <h3 className="text-xl font-bold mb-6">Payout History</h3>
        <table className="w-full">
          <thead>
            <tr className="text-left text-muted-foreground text-sm uppercase tracking-wider">
              <th className="pb-4">Date</th>
              <th className="pb-4">Amount</th>
              <th className="pb-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.payouts.map((payout: any) => (
              <tr key={payout.id} className="border-t border-border">
                <td className="py-4">{new Date(payout.created_at).toLocaleDateString()}</td>
                <td className="py-4">Ksh {Number(payout.amount).toLocaleString()}</td>
                <td className="py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${payout.status === 'processed' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                    {payout.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Earnings Breakdown Table */}
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
        <h3 className="text-xl font-bold mb-6">Earnings Breakdown</h3>
        <table className="w-full">
          <thead>
            <tr className="text-left text-muted-foreground text-sm uppercase tracking-wider">
              <th className="pb-4">Car</th>
              <th className="pb-4">Dates</th>
              <th className="pb-4">Gross Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.bookings.map((booking: any) => (
              <tr key={booking.id} className="border-t border-border">
                <td className="py-4">{booking.cars?.make} {booking.cars?.model}</td>
                <td className="py-4">{new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}</td>
                <td className="py-4">Ksh {Number(booking.total_amount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
