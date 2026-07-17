// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { clientService } from '../../services/clientService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Inbox, Send, Plus, Clock, MessageSquare, User, Shield, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getMessageThreadKey } from '../../utils/messagingThread';

export function MyInbox() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[][]>([]);
  const [extensionRequests, setExtensionRequests] = useState<any[]>([]);
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'messages' | 'extensions' | 'support'>('messages');
  const [selectedConversation, setSelectedConversation] = useState<any[] | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);

  // Support Form State
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');

  // Extension Form State
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [extensionReason, setExtensionReason] = useState('');

  // Honor deep-link query params from Dashboard / MyBookings
  useEffect(() => {
    const action = searchParams.get('action');
    const bookingId = searchParams.get('bookingId');
    if (action === 'extension') {
      setActiveTab('extensions');
      if (bookingId) setSelectedBookingId(bookingId);
    } else if (action === 'support') {
      setActiveTab('support');
      if (bookingId) setSupportSubject(`Booking #${String(bookingId).slice(0, 8)} — `);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchData();
  }, [user]);

  // Realtime: refresh when new messages or extension requests touch this client
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`client-inbox-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'extension_requests', filter: `client_id=eq.${user.id}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const fetchData = async () => {
    try {
      if (user) {
        setCurrentUser(user);
        const [msgs, exts, bks] = await Promise.all([
          clientService.getMessages(user.id),
          clientService.getExtensionRequests(user.id),
          clientService.getAllBookings(user.id)
        ]);
        
        const validMsgs = msgs || [];
        const groups = validMsgs.reduce((acc: any, msg: any) => {
          const key = getMessageThreadKey(msg);
          if (!acc[key]) acc[key] = [];
          acc[key].push(msg);
          return acc;
        }, {});
        
        const sortedGroups: any[][] = Object.values(groups).sort((a: any, b: any) => 
          new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime()
        );

        setConversations(sortedGroups);
        setExtensionRequests(exts || []);
        setActiveBookings(bks?.filter((b: any) => b.status === 'on_trip' || b.status === 'in_progress') || []);

        if (selectedConversation && sortedGroups.length > 0) {
           const updatedThread = sortedGroups.find((g: any) => 
             getMessageThreadKey(g[0]) === getMessageThreadKey(selectedConversation[0])
           );
           if (updatedThread) setSelectedConversation(updatedThread);
        }

        const admins = await supabase
          .from('user_profiles')
          .select('id')
          .eq('role', 'admin')
          .limit(1)
          .maybeSingle();
        setAdminUserId(admins.data?.id || null);
      }
    } catch (err) {
      console.error("Error fetching inbox data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    const threadRoot = selectedConversation[0];
    const counterparty = selectedConversation.find((m: any) => m.sender_id !== currentUser.id || m.receiver_id === currentUser.id);
    const receiverId = counterparty
      ? (counterparty.sender_id === currentUser.id ? counterparty.receiver_id : counterparty.sender_id)
      : adminUserId;

    if (!receiverId) {
      toast.error('Could not resolve recipient for this thread.');
      return;
    }

    const msg = {
      sender_id: currentUser.id,
      receiver_id: receiverId,
      booking_id: threadRoot.booking_id,
      subject: threadRoot.subject,
      content: newMessage,
      status: 'new'
    };

    try {
      await clientService.sendMessage(msg);
      setNewMessage('');
      fetchData(); // Refresh to show new message
    } catch (err) {
      toast.error('Failed to send message.');
      console.error("Error sending message:", err);
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportMessage.trim()) return;

    const msg = {
      sender_id: currentUser.id,
      receiver_id: adminUserId, // explicit admin routing
      subject: `SUPPORT: ${supportSubject}`,
      content: supportMessage,
      status: 'new',
      urgency: 'medium'
    };

    if (!msg.receiver_id) {
      toast.error('Support team is currently unavailable. Please try again shortly.');
      return;
    }

    try {
      await clientService.sendMessage(msg);
      setSupportSubject('');
      setSupportMessage('');
      setActiveTab('messages');
      setSearchParams({}, { replace: true });
      toast.success('Support request sent. We will reply shortly.');
      fetchData();
    } catch (err) {
      toast.error('Failed to submit support request.');
      console.error("Error submitting support request:", err);
    }
  };

  const handleExtensionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId || !newEndDate) {
      toast.error('Please select a booking and a new drop-off date.');
      return;
    }

    const req = {
      booking_id: selectedBookingId,
      client_id: currentUser.id,
      new_end_date: newEndDate,
      reason: extensionReason,
      status: 'pending'
    };

    try {
      await clientService.submitExtensionRequest(req);
      setSelectedBookingId('');
      setNewEndDate('');
      setExtensionReason('');
      setSearchParams({}, { replace: true });
      toast.success('Extension request submitted. Awaiting admin approval.');
      fetchData();
    } catch (err) {
      toast.error('Failed to submit extension request.');
      console.error("Error submitting extension request:", err);
    }
  };

  if (loading) return <div className="p-8">Loading Communication Hub...</div>;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Communication & Support</h2>
        <div className="flex bg-muted p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('messages')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'messages' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
          >
            My Inbox
          </button>
          <button 
            onClick={() => setActiveTab('extensions')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'extensions' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
          >
            Extensions
          </button>
          <button 
            onClick={() => setActiveTab('support')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'support' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
          >
            New Support
          </button>
        </div>
      </div>

      {activeTab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[600px]">
          {/* Conversations List */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border bg-muted/30">
              <h3 className="font-bold flex items-center gap-2">
                <Inbox size={18} /> Conversations
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length > 0 ? (
                conversations.map((thread, idx) => {
                  const latestMsg = thread[0];
                  return (
                    <button 
                      key={latestMsg.id || idx}
                      onClick={() => setSelectedConversation(thread)}
                      className={`w-full p-4 text-left border-b border-border hover:bg-muted/50 transition-colors ${selectedConversation && selectedConversation[0].id === latestMsg.id ? 'bg-muted' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-bold text-sm truncate pr-2">{latestMsg.subject || 'No Subject'} <span className="text-[10px] text-muted-foreground ml-1">({thread.length})</span></p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(latestMsg.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{latestMsg.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          latestMsg.sender_id === currentUser.id ? 'bg-blue-100 text-blue-600' : 'bg-primary/10 text-primary'
                        }`}>
                          {latestMsg.sender_id === currentUser.id ? 'Sent' : 'Received'}
                        </span>
                        {latestMsg.status === 'new' && <div className="w-2 h-2 bg-primary rounded-full" />}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="mx-auto mb-2 opacity-20" size={32} />
                  <p className="text-xs">No conversations yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
            {selectedConversation ? (
              <>
                <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm">{selectedConversation[0].subject}</h3>
                    <p className="text-xs text-muted-foreground">
                      With: {selectedConversation[0].sender_id === currentUser.id ? 
                        (selectedConversation[0].receiver?.full_name || 'Admin') : 
                        (selectedConversation[0].sender?.full_name || 'Admin')}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-1 bg-muted rounded-lg">
                    {selectedConversation[0].status}
                  </span>
                </div>
                <div className="flex-1 p-6 overflow-y-auto space-y-4 flex flex-col-reverse">
                  {selectedConversation.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                        msg.sender_id === currentUser.id ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted rounded-tl-none'
                      }`}>
                        {msg.content}
                        <p className="text-[10px] mt-2 opacity-70">{new Date(msg.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSendMessage} className="p-4 border-t border-border bg-muted/10 flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Type your message..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 px-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button 
                    type="submit"
                    className="p-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
                  >
                    <Send size={20} />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                <Inbox size={48} className="mb-4 opacity-10" />
                <p className="font-bold">Select a conversation</p>
                <p className="text-xs">Choose a message from the list to start chatting.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'extensions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Extension Form */}
          <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="text-primary" size={20} />
              <h3 className="text-lg font-semibold">Request Extension</h3>
            </div>
            <form onSubmit={handleExtensionSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Select Active Booking</label>
                <select 
                  value={selectedBookingId}
                  onChange={(e) => setSelectedBookingId(e.target.value)}
                  className="w-full px-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Choose a car...</option>
                  {activeBookings.map(b => (
                    <option key={b.id} value={b.id}>{b.cars.make} {b.cars.model} (Ends: {new Date(b.end_date).toLocaleDateString()})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">New Drop-off Date</label>
                <input 
                  type="date" 
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="w-full px-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Reason for Extension</label>
                <textarea 
                  rows={3}
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  className="w-full px-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  placeholder="Tell us why you need more time..."
                />
              </div>
              <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                <p className="text-xs text-muted-foreground mb-1">Estimated Additional Cost</p>
                <p className="text-lg font-bold text-primary">Calculated upon approval</p>
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> Extensions are subject to car availability and admin approval.
                </p>
              </div>
              <button 
                type="submit"
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors"
              >
                Submit Extension Request
              </button>
            </form>
          </section>

          {/* Request History */}
          <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <h3 className="text-lg font-semibold mb-6">Request History</h3>
            <div className="space-y-4">
              {extensionRequests.length > 0 ? (
                extensionRequests.map(req => (
                  <div key={req.id} className="p-4 border border-border rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-sm">{req.bookings.cars.make} {req.bookings.cars.model}</p>
                        <p className="text-xs text-muted-foreground">Requested until: {new Date(req.new_end_date).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg ${
                        req.status === 'approved' ? 'bg-green-100 text-green-600' : 
                        req.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                    {req.reason && <p className="text-xs text-muted-foreground italic mt-2">"{req.reason}"</p>}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No extension requests found.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'support' && (
        <div className="max-w-2xl mx-auto">
          <section className="bg-card p-8 rounded-2xl border border-border shadow-sm">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="text-primary" size={32} />
              </div>
              <h3 className="text-xl font-bold">How can we help?</h3>
              <p className="text-sm text-muted-foreground">Submit a support request and our team will get back to you shortly.</p>
            </div>
            <form onSubmit={handleSupportSubmit} className="space-y-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Subject</label>
                <input 
                  type="text" 
                  placeholder="e.g. Question about my booking"
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  className="w-full px-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Message</label>
                <textarea 
                  rows={6}
                  placeholder="Describe your issue in detail..."
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  className="w-full px-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
              <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-xl border border-dashed border-border">
                <Plus size={20} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Attach a photo or document (optional)</span>
              </div>
              <button 
                type="submit"
                className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
              >
                Submit Request
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}