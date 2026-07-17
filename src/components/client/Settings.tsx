import React, { useEffect, useState } from 'react';
import { clientService } from '../../services/clientService';
import { supabase } from '../../lib/supabase';
import { 
  Shield, 
  Bell, 
  CreditCard, 
  Lock, 
  Globe, 
  Smartphone, 
  Trash2, 
  Download, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  LogOut
} from 'lucide-react';

export function Settings() {
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        const prefs = await clientService.getPreferences(user.id);
        setPreferences(prefs || {
          booking_notifications: true,
          marketing_notifications: false,
          security_notifications: true,
          preferred_currency: 'KES',
          preferred_language: 'en'
        });
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePreferences = async (updates: any) => {
    setSaving(true);
    try {
      const newPrefs = { ...preferences, ...updates };
      await clientService.updatePreferences(currentUser.id, newPrefs);
      setPreferences(newPrefs);
      setMessage({ type: 'success', text: 'Settings updated successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update settings.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const handlePasswordReset = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(currentUser.email, {
        redirectTo: `${window.location.origin}/client/settings`,
      });
      if (error) throw error;
      setMessage({ type: 'success', text: 'Password reset link sent to your email!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to send reset link.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const handleExportData = async () => {
    try {
      setMessage({ type: 'success', text: 'Preparing your data export...' });
      const [bookings, transactions, messages] = await Promise.all([
        clientService.getAllBookings(currentUser.id),
        clientService.getTransactions(currentUser.id),
        clientService.getMessages(currentUser.id)
      ]);

      const data = {
        user: currentUser,
        preferences: preferences,
        bookings: bookings || [],
        transactions: transactions || [],
        messages: messages || [],
        exportDate: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-${currentUser.id.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      setMessage({ type: 'success', text: 'Data exported successfully.' });
    } catch (err) {
      console.error("Data export failed", err);
      setMessage({ type: 'error', text: 'Failed to export data.' });
    } finally {
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleRequestDeleteAccount = async () => {
    if (!currentUser) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('contact_messages').insert([{
        name: currentUser.user_metadata?.full_name || currentUser.email,
        email: currentUser.email,
        phone: currentUser.user_metadata?.phone || '',
        subject: 'Account Deletion Request',
        message: `User ${currentUser.email} (id: ${currentUser.id}) has requested permanent deletion of their account and all associated data. Please process within 30 days per data-protection policy.`,
      }]);
      if (error) throw error;
      setConfirmDelete(false);
      setMessage({ type: 'success', text: 'Deletion request submitted. Our team will contact you within 48 hours.' });
    } catch (err) {
      console.error('Delete request failed', err);
      setMessage({ type: 'error', text: 'Failed to submit deletion request.' });
    } finally {
      setDeleting(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    }
  };

  if (loading) return <div className="p-8">Loading settings...</div>;

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-2xl border border-border shadow-sm">
        <Lock className="text-muted-foreground mb-4 opacity-20" size={48} />
        <h3 className="text-lg font-bold">Authentication Required</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">
          Please log in to your account to view and manage your settings.
        </p>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-2xl border border-border shadow-sm">
        <AlertCircle className="text-muted-foreground mb-4 opacity-20" size={48} />
        <h3 className="text-lg font-bold">Settings Unavailable</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">
          We couldn't load your preferences. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Account Settings</h2>
        {message.text && (
          <div className={`px-4 py-2 rounded-xl text-sm font-bold animate-in fade-in slide-in-from-top-2 ${
            message.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Account Security */}
        <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="text-primary" size={20} />
            <h3 className="text-lg font-semibold">Account Security</h3>
          </div>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
              <div>
                <p className="font-bold text-sm">Update Password</p>
                <p className="text-xs text-muted-foreground">Change your password to keep your account secure.</p>
              </div>
              <button 
                onClick={handlePasswordReset}
                disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Send Reset Link
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
              <div>
                <p className="font-bold text-sm">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">Add an extra layer of security to your account.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" disabled />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary opacity-50"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Notification Preferences */}
        <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Bell className="text-primary" size={20} />
            <h3 className="text-lg font-semibold">Notification Preferences</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">Booking Alerts</p>
                <p className="text-xs text-muted-foreground">Pickup reminders, drop-off confirmations, and extension approvals.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={preferences.booking_notifications}
                  onChange={(e) => handleUpdatePreferences({ booking_notifications: e.target.checked })}
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">Marketing & Offers</p>
                <p className="text-xs text-muted-foreground">Promotional codes, loyalty tier updates, and new fleet announcements.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={preferences.marketing_notifications}
                  onChange={(e) => handleUpdatePreferences({ marketing_notifications: e.target.checked })}
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">Security Alerts</p>
                <p className="text-xs text-muted-foreground">Mandatory notifications for password changes or new device logins.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={preferences.security_notifications}
                  disabled
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary opacity-50"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Regional & Localization */}
        <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Globe className="text-primary" size={20} />
            <h3 className="text-lg font-semibold">Regional & Localization</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Preferred Language</label>
              <select 
                value={preferences.preferred_language}
                onChange={(e) => handleUpdatePreferences({ preferred_language: e.target.value })}
                className="w-full px-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="en">English</option>
                <option value="sw">Swahili</option>
                <option value="fr">French</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Preferred Currency</label>
              <select 
                value={preferences.preferred_currency}
                onChange={(e) => handleUpdatePreferences({ preferred_currency: e.target.value })}
                className="w-full px-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="KES">Kenyan Shilling (KES)</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Privacy & Data Control */}
        <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="text-primary" size={20} />
            <h3 className="text-lg font-semibold">Privacy & Data Control</h3>
          </div>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
              <div>
                <p className="font-bold text-sm">Download My Data</p>
                <p className="text-xs text-muted-foreground">Get a copy of your personal info, booking history, and documents.</p>
              </div>
              <button 
                onClick={handleExportData}
                className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-xl text-xs font-bold transition-colors"
              >
                <Download size={16} /> Export JSON
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-error/5 border border-error/10 rounded-xl">
              <div>
                <p className="font-bold text-sm text-error">Delete Account</p>
                <p className="text-xs text-muted-foreground">Permanently remove your account and all associated data.</p>
              </div>
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 px-4 py-2 bg-error text-white rounded-xl text-xs font-bold hover:bg-error/90 transition-colors"
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
            {confirmDelete && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !deleting && setConfirmDelete(false)}>
                <div className="bg-card rounded-2xl border border-border shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
                      <AlertCircle className="text-error" size={20} />
                    </div>
                    <h3 className="text-lg font-bold">Delete your account?</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This will submit a permanent account-deletion request. Our team will process it within 30 days as required by data-protection policy. Active bookings must be completed or cancelled first.
                  </p>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="flex-1 px-4 py-2 bg-muted rounded-xl text-sm font-bold hover:bg-muted/70 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRequestDeleteAccount}
                      disabled={deleting}
                      className="flex-1 px-4 py-2 bg-error text-white rounded-xl text-sm font-bold hover:bg-error/90 transition-colors disabled:opacity-50"
                    >
                      {deleting ? 'Submitting...' : 'Confirm Request'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
