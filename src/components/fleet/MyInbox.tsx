import React, { useEffect, useState } from 'react';
import { fleetService } from '../../services/fleetService';
import { supabase } from '../../lib/supabase';

export function MyInbox() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const data = await fleetService.getMessages(user.id);
        setMessages(data || []);
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading inbox...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">My Inbox</h2>
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="text-left text-muted-foreground text-sm uppercase tracking-wider">
              <th className="pb-4">Sender</th>
              <th className="pb-4">Subject</th>
              <th className="pb-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((msg: any) => (
              <tr key={msg.id} className="border-t border-border">
                <td className="py-4">{msg.sender?.full_name || 'Admin'}</td>
                <td className="py-4">{msg.subject}</td>
                <td className="py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${msg.status === 'new' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {msg.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
