import React, { useEffect, useState } from 'react';
import { fleetService } from '../../services/fleetService';
import { supabase } from '../../lib/supabase';
import { Check, X } from 'lucide-react';

export function BookingRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const data = await fleetService.getPendingBookingRequests(user.id);
        setRequests(data || []);
      }
    } catch (err) {
      console.error("Error fetching booking requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (bookingId: string, status: string) => {
    try {
      await fleetService.updateBookingStatus(bookingId, status);
      fetchRequests();
    } catch (err) {
      console.error("Error updating booking status:", err);
    }
  };

  if (loading) return <div className="p-8">Loading booking requests...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Booking Requests</h2>
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="text-left text-muted-foreground text-sm uppercase tracking-wider">
              <th className="pb-4">Car</th>
              <th className="pb-4">Client</th>
              <th className="pb-4">Dates</th>
              <th className="pb-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req: any) => (
              <tr key={req.id} className="border-t border-border">
                <td className="py-4">{req.cars?.make} {req.cars?.model}</td>
                <td className="py-4">{req.client?.full_name}</td>
                <td className="py-4">{new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}</td>
                <td className="py-4 flex gap-2">
                  <button onClick={() => handleStatusUpdate(req.id, 'confirmed')} className="p-2 bg-success/10 text-success rounded-xl hover:bg-success/20">
                    <Check size={18} />
                  </button>
                  <button onClick={() => handleStatusUpdate(req.id, 'cancelled')} className="p-2 bg-error/10 text-error rounded-xl hover:bg-error/20">
                    <X size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
