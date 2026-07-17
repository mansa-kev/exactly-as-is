// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { adminService } from '../../services/adminService';
import { supabase } from '../../lib/supabase';
import { 
  Search, 
  Inbox, 
  Star, 
  Trash2, 
  Archive, 
  MoreVertical, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Send,
  Paperclip,
  Smile,
  Loader2
} from 'lucide-react';
import { getMessageThreadKey, normalizeSubject } from '../../utils/messagingThread';
import { debounce } from '../../utils/debounce';

// --- Types ---

interface Message {
  id: string;
  sender: string;
  sender_id: string;
  subject: string;
  preview: string;
  content: string;
  time: string;
  date: string;
  status: 'new' | 'open' | 'resolved';
  urgency: 'low' | 'medium' | 'high';
  unread: boolean;
  receiver_id?: string | null;
  created_at?: string;
}

// --- Components ---

const BroadcastComposer = ({ onClose, onSend }: { onClose: () => void, onSend: (b: any) => void }) => {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [targetGroup, setTargetGroup] = useState('all');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
      <div className="bg-card p-8 rounded-2xl border border-border shadow-xl w-full max-w-lg">
        <h3 className="font-bold text-lg mb-6">Broadcast Message</h3>
        <input type="text" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} className="w-full p-3 mb-4 bg-muted rounded-xl text-sm" />
        <textarea placeholder="Content" value={content} onChange={e => setContent(e.target.value)} className="w-full p-3 mb-4 bg-muted rounded-xl text-sm h-32" />
        <select value={targetGroup} onChange={e => setTargetGroup(e.target.value)} className="w-full p-3 mb-6 bg-muted rounded-xl text-sm">
          <option value="all">All Users</option>
          <option value="clients">Clients</option>
          <option value="fleet_owners">Fleet Owners</option>
        </select>
        <div className="flex gap-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-muted rounded-xl text-sm font-bold">Cancel</button>
          <button onClick={() => onSend({ subject, content, target_group: targetGroup })} className="flex-1 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold">Send</button>
        </div>
      </div>
    </div>
  );
};

export function AdminInbox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const hasLoadedRef = useRef(false);

  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent || !hasLoadedRef.current) setLoading(true);
    try {
      const [messagesData, contactData] = await Promise.all([
        adminService.getMessages(),
        supabase
          .from('contact_messages')
          .select('id, name, phone, subject, message, created_at')
          .order('created_at', { ascending: false })
          .limit(200)
          .then((r) => r.data || []),
      ]);

      const formattedMessages: Message[] = [
        ...(messagesData || []).map((m: any) => ({
          id: m.id,
          sender: m.sender?.full_name || 'Anonymous',
          sender_id: m.sender_id,
          subject: m.subject || 'No Subject',
          preview: m.content.substring(0, 50) + '...',
          content: m.content,
          time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date(m.created_at).toLocaleDateString(),
          status: m.status as any,
          urgency: m.urgency as any,
          unread: m.status === 'new',
          receiver_id: m.receiver_id,
          created_at: m.created_at,
        })),
        ...(contactData || []).map((m: any) => ({
          id: `contact:${m.id}`,
          sender: m.name || m.phone || 'Website Visitor',
          sender_id: '',
          subject: m.subject || 'Website Contact',
          preview: String(m.message || '').substring(0, 50) + '...',
          content: `${m.message || ''}${m.phone ? `\n\nPhone: ${m.phone}` : ''}`,
          time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date(m.created_at).toLocaleDateString(),
          status: 'new',
          urgency: (String(m.subject || '').toLowerCase().includes('callback') ? 'high' : 'medium') as any,
          unread: true,
          receiver_id: null,
          created_at: m.created_at,
        })),
      ].sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());

      setMessages(formattedMessages);
      hasLoadedRef.current = true;
      setSelectedId((current) => current || formattedMessages[0]?.id || null);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshMessages = useCallback(
    debounce(() => {
      void fetchMessages(true);
    }, 800),
    [fetchMessages]
  );

  const handleSendBroadcast = async (b: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await adminService.sendBroadcast({ ...b, sender_id: user.id });
      setShowBroadcast(false);
      alert('Broadcast sent!');
    } catch (error) {
      alert('Failed to send broadcast');
    }
  };

  const [showBroadcast, setShowBroadcast] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => refreshMessages())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contact_messages' }, () => refreshMessages())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshMessages]);

  const handleSendMessage = async () => {
    if (!replyText.trim() || !selectedId) return;
    const selectedMessage = messages.find(m => m.id === selectedId);
    if (!selectedMessage) return;
    if (!selectedMessage.sender_id || selectedMessage.id.startsWith('contact:')) {
      alert('Direct reply for website contact requests is handled through phone/WhatsApp.');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const recipientId = selectedMessage.sender_id === user.id
        ? selectedMessage.receiver_id
        : selectedMessage.sender_id;

      if (!recipientId) throw new Error('Recipient not found for this thread');

      await adminService.sendMessage({
        sender_id: user.id,
        receiver_id: recipientId,
        subject: normalizeSubject(selectedMessage.subject),
        content: replyText,
        status: 'new'
      });
      setReplyText('');
      await fetchMessages(true);
      alert('Reply sent!');
    } catch (error) {
      alert('Failed to send reply');
    }
  };

  const filteredMessages = messages.filter(m => {
    const matchesSearch = m.sender.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          m.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const selectedMessage = messages.find(m => m.id === selectedId);
  const threadMap = filteredMessagesByThread(filteredMessages);
  const threadMessages = selectedMessage ? (threadMap[getMessageThreadKey(selectedMessage)] || [selectedMessage]) : [];

  function filteredMessagesByThread(items: Message[]) {
    return items.reduce((acc: Record<string, Message[]>, message) => {
      const key = getMessageThreadKey(message as any);
      if (!acc[key]) acc[key] = [];
      acc[key].push(message);
      acc[key].sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime());
      return acc;
    }, {});
  }

  if (loading && messages.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex animate-in fade-in duration-150">
      {/* Sidebar: Message List */}
      <div className="w-96 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setShowBroadcast(true)} className="flex-1 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold">Broadcast</button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input 
              type="text" 
              placeholder="Search messages..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-muted border-none rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>
        {showBroadcast && <BroadcastComposer onClose={() => setShowBroadcast(false)} onSend={handleSendBroadcast} />}
        <div className="flex-1 overflow-y-auto divide-y divide-border scrollbar-hide">
          {filteredMessages.map((msg) => (
            <button
              key={msg.id}
              onClick={() => setSelectedId(msg.id)}
              className={`w-full text-left p-4 hover:bg-muted/50 transition-colors relative ${
                selectedId === msg.id ? 'bg-primary/5' : ''
              }`}
            >
              {msg.unread && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
              )}
              <div className="flex justify-between items-start mb-1">
                <span className={`text-sm font-bold ${msg.unread ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {msg.sender}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">{msg.time}</span>
              </div>
              <p className={`text-xs font-bold truncate mb-1 ${msg.unread ? 'text-foreground' : 'text-muted-foreground'}`}>
                {msg.subject}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-1">{msg.preview}</p>
              <div className="flex gap-2 mt-2">
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                  msg.urgency === 'high' ? 'bg-error/10 text-error border-error/20' : 
                  msg.urgency === 'medium' ? 'bg-warning/10 text-warning border-warning/20' : 
                  'bg-success/10 text-success border-success/20'
                }`}>
                  {msg.urgency}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[8px] font-bold uppercase tracking-wider border border-border">
                  {msg.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Chat/Message View */}
      <div className="flex-1 flex flex-col bg-muted/10">
        {selectedMessage ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-border bg-card flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <User size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{selectedMessage.sender}</h3>
                  <p className="text-xs text-muted-foreground">{selectedMessage.subject}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"><Star size={20} /></button>
                <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"><Archive size={20} /></button>
                <button className="p-2 hover:bg-error/10 rounded-lg text-error transition-colors"><Trash2 size={20} /></button>
                <div className="h-6 w-[1px] bg-border mx-2" />
                <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"><MoreVertical size={20} /></button>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
              <div className="flex flex-col items-center mb-8">
                <div className="px-3 py-1 bg-muted rounded-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {selectedMessage.date}
                </div>
              </div>

              {threadMessages.map((msg) => (
                <div key={msg.id} className="flex gap-4 max-w-2xl">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex-shrink-0 flex items-center justify-center">
                    <User size={16} />
                  </div>
                  <div className="space-y-2">
                    <div className="bg-card p-4 rounded-2xl rounded-tl-none border border-border shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        {msg.sender}
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">{msg.content}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium ml-1">{msg.time}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="p-6 bg-card border-t border-border">
              <div className="relative flex items-center gap-4">
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    placeholder="Type your reply..." 
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="w-full pl-4 pr-24 py-3 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-muted-foreground">
                    <button className="p-1.5 hover:bg-muted rounded-lg transition-colors"><Smile size={18} /></button>
                    <button className="p-1.5 hover:bg-muted rounded-lg transition-colors"><Paperclip size={18} /></button>
                  </div>
                </div>
                <button 
                  onClick={handleSendMessage}
                  disabled={!selectedMessage.sender_id || selectedMessage.id.startsWith('contact:')}
                  className="p-3 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center text-muted-foreground mb-6">
              <Inbox size={40} />
            </div>
            <h3 className="text-xl font-bold mb-2">Select a message</h3>
            <p className="text-muted-foreground max-w-xs">Choose a conversation from the list to view the details and reply.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const Shield = ({ size, className }: { size?: number, className?: string }) => (
  <svg 
    width={size || 24} 
    height={size || 24} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);