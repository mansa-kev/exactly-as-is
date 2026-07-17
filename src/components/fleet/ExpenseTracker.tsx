import React, { useEffect, useState } from 'react';
import { fleetService } from '../../services/fleetService';
import { supabase } from '../../lib/supabase';
import { Plus } from 'lucide-react';

export function ExpenseTracker() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: '', date: '' });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const data = await fleetService.getExpenses(user.id);
        setExpenses(data || []);
      }
    } catch (err) {
      console.error("Error fetching expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await fleetService.addExpense({ ...newExpense, user_id: user.id, amount: Number(newExpense.amount) });
        setNewExpense({ description: '', amount: '', category: '', date: '' });
        fetchExpenses();
      }
    } catch (err) {
      console.error("Error adding expense:", err);
    }
  };

  if (loading) return <div className="p-8">Loading expenses...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Expense Tracker</h2>
      </div>
      
      <form onSubmit={handleAddExpense} className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-4">
        <h3 className="text-lg font-bold">Add New Expense</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input type="text" placeholder="Description" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} className="p-2 bg-muted rounded-xl" required />
          <input type="number" placeholder="Amount" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} className="p-2 bg-muted rounded-xl" required />
          <input type="text" placeholder="Category" value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})} className="p-2 bg-muted rounded-xl" required />
          <input type="date" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} className="p-2 bg-muted rounded-xl" required />
        </div>
        <button type="submit" className="bg-primary text-white px-4 py-2 rounded-xl flex items-center gap-2">
          <Plus size={20} /> Add Expense
        </button>
      </form>

      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="text-left text-muted-foreground text-sm uppercase tracking-wider">
              <th className="pb-4">Date</th>
              <th className="pb-4">Description</th>
              <th className="pb-4">Category</th>
              <th className="pb-4">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense: any) => (
              <tr key={expense.id} className="border-t border-border">
                <td className="py-4">{new Date(expense.date).toLocaleDateString()}</td>
                <td className="py-4">{expense.description}</td>
                <td className="py-4">{expense.category}</td>
                <td className="py-4">Ksh {Number(expense.amount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
