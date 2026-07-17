import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { 
  Settings, 
  User, 
  Bell, 
  Shield, 
  Globe, 
  Mail, 
  Lock, 
  Smartphone, 
  Save,
  Plus,
  Trash2,
  Loader2,
  Image
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminLogoManager } from './AdminLogoManager';
import { AdminImageManager } from './AdminImageManager';

// --- Components ---

export function AdminSettings() {
  const [activeSection, setActiveSection] = useState<'general' | 'logo' | 'images' | 'auth' | 'notifications' | 'admins' | 'payments' | 'compliance' | 'integrations'>('general');
  const [settings, setSettings] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsData, adminsData] = await Promise.all([
        adminService.getSettings(),
        adminService.getAdmins()
      ]);
      setSettings(settingsData || []);
      setAdmins(adminsData || []);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateSetting = async (key: string, value: any) => {
    const promise = adminService.updateSetting(key, value).then(() => fetchData());
    
    toast.promise(promise, {
      loading: 'Updating setting...',
      success: 'Setting updated successfully',
      error: 'Failed to update setting'
    });
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail) return;
    const promise = (async () => {
      await adminService.addAdmin(newAdminEmail);
      setNewAdminEmail('');
      fetchData();
    })();

    toast.promise(promise, {
      loading: 'Adding administrator...',
      success: 'Administrator added successfully',
      error: 'Failed to add admin. Make sure the user exists.'
    });
  };

  const handleRemoveAdmin = async (id: string) => {
    const promise = (async () => {
      await adminService.removeAdmin(id);
      fetchData();
    })();

    toast.promise(promise, {
      loading: 'Removing administrator...',
      success: 'Administrator removed successfully',
      error: 'Failed to remove admin'
    });
  };

  const getSettingValue = (key: string, defaultValue: any) => {
    const setting = settings.find(s => s.key === key);
    return setting ? setting.value : defaultValue;
  };

  if (loading && settings.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-150">
      {/* Sidebar Navigation */}
      <div className="w-full lg:w-64 space-y-2">
        <button
          onClick={() => setActiveSection('general')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            activeSection === 'general' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-card text-muted-foreground hover:bg-muted'
          }`}
        >
          <Globe size={18} /> General
        </button>
        <button
          onClick={() => setActiveSection('logo')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            activeSection === 'logo' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-card text-muted-foreground hover:bg-muted'
          }`}
        >
          <Image size={18} /> Logo
        </button>
        <button
          onClick={() => setActiveSection('images')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            activeSection === 'images' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-card text-muted-foreground hover:bg-muted'
          }`}
        >
          <Image size={18} /> Images
        </button>
        <button
          onClick={() => setActiveSection('auth')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            activeSection === 'auth' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-card text-muted-foreground hover:bg-muted'
          }`}
        >
          <Lock size={18} /> Authentication
        </button>
        <button
          onClick={() => setActiveSection('notifications')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            activeSection === 'notifications' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-card text-muted-foreground hover:bg-muted'
          }`}
        >
          <Bell size={18} /> Notifications
        </button>
        <button
          onClick={() => setActiveSection('admins')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            activeSection === 'admins' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-card text-muted-foreground hover:bg-muted'
          }`}
        >
          <Shield size={18} /> Admin Access
        </button>
        <button
          onClick={() => setActiveSection('payments')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            activeSection === 'payments' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-card text-muted-foreground hover:bg-muted'
          }`}
        >
          <Smartphone size={18} /> Payments
        </button>
        <button
          onClick={() => setActiveSection('compliance')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            activeSection === 'compliance' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-card text-muted-foreground hover:bg-muted'
          }`}
        >
          <Shield size={18} /> Compliance
        </button>
        <button
          onClick={() => setActiveSection('integrations')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            activeSection === 'integrations' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-card text-muted-foreground hover:bg-muted'
          }`}
        >
          <Globe size={18} /> Integrations
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 space-y-8">
        {activeSection === 'general' && (
          <div className="bg-card p-8 rounded-2xl border border-border shadow-sm space-y-8">
            <h3 className="text-xl font-bold border-b border-border pb-4">General Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Platform Name</label>
                <input 
                  type="text" 
                  defaultValue={getSettingValue('platform_name', 'Linkedup Cars Rentals')} 
                  onBlur={(e) => handleUpdateSetting('platform_name', e.target.value)}
                  className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Support Email</label>
                <input 
                  type="email" 
                  defaultValue={getSettingValue('support_email', 'support@linkedupcars.com')} 
                  onBlur={(e) => handleUpdateSetting('support_email', e.target.value)}
                  className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contact Phone</label>
                <input 
                  type="text" 
                  defaultValue={getSettingValue('contact_phone', '+1 (555) 000-0000')} 
                  onBlur={(e) => handleUpdateSetting('contact_phone', e.target.value)}
                  className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Default Currency</label>
                <select 
                  defaultValue={getSettingValue('default_currency', 'USD')}
                  onChange={(e) => handleUpdateSetting('default_currency', e.target.value)}
                  className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="KES">KES (Ksh)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'logo' && (
          <AdminLogoManager />
        )}

        {activeSection === 'images' && (
          <AdminImageManager />
        )}

        {activeSection === 'auth' && (
          <div className="bg-card p-8 rounded-2xl border border-border shadow-sm space-y-8">
            <h3 className="text-xl font-bold border-b border-border pb-4">Authentication & Security</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
                <div>
                  <h4 className="font-bold text-sm">Google Authentication</h4>
                  <p className="text-xs text-muted-foreground">Allow users to sign in using their Google account.</p>
                </div>
                <div 
                  onClick={() => handleUpdateSetting('google_auth_enabled', !getSettingValue('google_auth_enabled', true))}
                  className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${getSettingValue('google_auth_enabled', true) ? 'bg-primary' : 'bg-muted'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${getSettingValue('google_auth_enabled', true) ? 'right-1' : 'left-1'}`} />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
                <div>
                  <h4 className="font-bold text-sm">Two-Factor Authentication (2FA)</h4>
                  <p className="text-xs text-muted-foreground">Require 2FA for all administrative accounts.</p>
                </div>
                <div 
                  onClick={() => handleUpdateSetting('2fa_required', !getSettingValue('2fa_required', false))}
                  className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${getSettingValue('2fa_required', false) ? 'bg-primary' : 'bg-muted'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${getSettingValue('2fa_required', false) ? 'right-1' : 'left-1'}`} />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'notifications' && (
          <div className="bg-card p-8 rounded-2xl border border-border shadow-sm space-y-8">
            <h3 className="text-xl font-bold border-b border-border pb-4">Notification Preferences</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Email Notifications', key: 'email_notifications_enabled' },
                  { label: 'SMS Alerts', key: 'sms_alerts_enabled' },
                  { label: 'Push Notifications', key: 'push_notifications_enabled' }
                ].map((item) => (
                  <div key={item.key} className="p-4 bg-muted/30 rounded-xl border border-border flex flex-col items-center text-center gap-3">
                    <div className="p-3 bg-primary/10 text-primary rounded-full">
                      {item.key.includes('email') ? <Mail size={20} /> : item.key.includes('sms') ? <Smartphone size={20} /> : <Bell size={20} />}
                    </div>
                    <h4 className="font-bold text-sm">{item.label}</h4>
                    <div 
                      onClick={() => handleUpdateSetting(item.key, !getSettingValue(item.key, true))}
                      className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${getSettingValue(item.key, true) ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${getSettingValue(item.key, true) ? 'right-1' : 'left-1'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'admins' && (
          <div className="bg-card p-8 rounded-2xl border border-border shadow-sm space-y-8">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <h3 className="text-xl font-bold">Administrator Management</h3>
              <div className="flex gap-2">
                <input 
                  type="email" 
                  placeholder="Admin email..." 
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="px-4 py-2 bg-muted border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button 
                  onClick={handleAddAdmin}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-xs hover:scale-105 transition-transform shadow-lg shadow-primary/20"
                >
                  <Plus size={16} /> Add Admin
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {admins.map((admin) => (
                <div key={admin.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      {admin.full_name?.charAt(0) || 'A'}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">{admin.full_name || 'No Name'}</h4>
                      <p className="text-xs text-muted-foreground">{admin.email || 'No Email'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded text-[10px] font-bold uppercase tracking-wider">
                      {admin.role}
                    </span>
                    <button 
                      onClick={() => handleRemoveAdmin(admin.id)}
                      className="p-2 hover:bg-error/10 text-error rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'payments' && (
          <div className="bg-card p-8 rounded-2xl border border-border shadow-sm space-y-8">
            <h3 className="text-xl font-bold border-b border-border pb-4">Payment Gateway Configuration</h3>
            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-bold text-lg text-warning">Reservation Fee Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reservation Fee (KES)</label>
                    <input 
                      type="number" 
                      min="0"
                      defaultValue={getSettingValue('reservation_fee', 500)}
                      onBlur={(e) => handleUpdateSetting('reservation_fee', parseInt(e.target.value) || 500)}
                      className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm focus:ring-2 focus:ring-warning/20" 
                    />
                    <p className="text-xs text-muted-foreground">Fee charged to reserve a car for 24 hours</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reservation Expiry (Hours)</label>
                    <select 
                      defaultValue={getSettingValue('reservation_expiry_hours', 24)}
                      onChange={(e) => handleUpdateSetting('reservation_expiry_hours', parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm focus:ring-2 focus:ring-warning/20"
                    >
                      <option value="12">12 Hours</option>
                      <option value="24">24 Hours</option>
                      <option value="48">48 Hours</option>
                      <option value="72">72 Hours</option>
                    </select>
                    <p className="text-xs text-muted-foreground">Time before reservation expires</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4 pt-6 border-t border-border">
                <h4 className="font-bold text-lg">M-Pesa Configuration</h4>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">M-Pesa API Key</label>
                <input type="password" onBlur={(e) => handleUpdateSetting('mpesa_api_key', e.target.value)} className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm" />
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">M-Pesa API Secret</label>
                <input type="password" onBlur={(e) => handleUpdateSetting('mpesa_api_secret', e.target.value)} className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm" />
              </div>
            </div>
          </div>
        )}

        {activeSection === 'compliance' && (
          <div className="bg-card p-8 rounded-2xl border border-border shadow-sm space-y-8">
            <h3 className="text-xl font-bold border-b border-border pb-4">Compliance & Legal</h3>
            <div className="space-y-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Terms of Service</label>
              <textarea onBlur={(e) => handleUpdateSetting('tos', e.target.value)} className="w-full h-64 px-4 py-2 bg-muted border-none rounded-xl text-sm" />
            </div>
          </div>
        )}

        {activeSection === 'integrations' && (
          <div className="bg-card p-8 rounded-2xl border border-border shadow-sm space-y-8">
            <h3 className="text-xl font-bold border-b border-border pb-4">System Integrations</h3>
            <div className="space-y-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">SMS Gateway API Key</label>
              <input type="password" onBlur={(e) => handleUpdateSetting('sms_api_key', e.target.value)} className="w-full px-4 py-2 bg-muted border-none rounded-xl text-sm" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
