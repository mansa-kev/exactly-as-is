import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fleetService } from '../../services/fleetService';
import { 
  Building2, 
  CreditCard, 
  ShieldCheck, 
  Bell, 
  Globe, 
  Lock, 
  Save, 
  AlertCircle, 
  CheckCircle2,
  Upload,
  Phone,
  Mail,
  Receipt,
  Clock,
  Zap,
  ChevronRight
} from 'lucide-react';
import { InternationalPhoneInput } from '../ui/InternationalPhoneInput';

export function FleetSettings() {
  const [settings, setSettings] = useState<any>(null);
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
        const data = await fleetService.getSettings(user.id);
        setSettings(data || {
          company_name: '',
          tax_id: '',
          support_email: user.email,
          support_phone: '',
          vat_status: false,
          vat_rate: 16,
          fuel_policy: 'Full to Full',
          late_return_grace_period: 60,
          late_return_penalty_multiplier: 1.5,
          booking_alerts: true,
          fleet_health_alerts: true,
          financial_alerts: true,
          timezone: 'Africa/Nairobi',
          preferred_currency: 'KES'
        });
      }
    } catch (err) {
      console.error("Error fetching fleet settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (updates: any) => {
    setSaving(true);
    try {
      const newSettings = { ...settings, ...updates };
      await fleetService.updateSettings(currentUser.id, newSettings);
      setSettings(newSettings);
      setMessage({ type: 'success', text: 'Settings updated successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update settings.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  if (loading) return <div className="p-8">Loading Fleet Settings...</div>;
  if (!settings) return <div className="p-8 text-center text-muted-foreground">Please sign in to manage fleet settings.</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Fleet Owner Settings</h2>
          <p className="text-sm text-muted-foreground">Manage your business profile, policies, and operational preferences.</p>
        </div>
        {message.text && (
          <div className={`px-4 py-2 rounded-xl text-sm font-bold animate-in fade-in slide-in-from-top-2 ${
            message.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Business & Branding */}
          <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Building2 className="text-primary" size={20} />
              <h3 className="text-lg font-bold">Business & Branding</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Company Name</label>
                <input 
                  type="text" 
                  value={settings.company_name}
                  onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                  onBlur={() => handleUpdate({ company_name: settings.company_name })}
                  className="w-full px-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Tax ID / PIN</label>
                <input 
                  type="text" 
                  value={settings.tax_id}
                  onChange={(e) => setSettings({ ...settings, tax_id: e.target.value })}
                  onBlur={() => handleUpdate({ tax_id: settings.tax_id })}
                  className="w-full px-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Support Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input 
                    type="email" 
                    value={settings.support_email}
                    onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                    onBlur={() => handleUpdate({ support_email: settings.support_email })}
                    className="w-full pl-10 pr-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Support Phone</label>
                <div className="relative">
                  <InternationalPhoneInput 
                    value={settings.support_phone}
                    onChange={(val) => setSettings({ ...settings, support_phone: val })}
                    className="bg-muted border-none"
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 p-4 border border-dashed border-border rounded-2xl flex items-center gap-4">
              <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center text-muted-foreground">
                {settings.logo_url ? <img src={settings.logo_url} className="w-full h-full object-contain" /> : <Building2 size={24} />}
              </div>
              <div>
                <p className="text-sm font-bold">Company Logo</p>
                <p className="text-xs text-muted-foreground mb-2">Appears on contracts and invoices.</p>
                <button className="flex items-center gap-2 text-xs font-bold text-primary hover:underline">
                  <Upload size={14} /> Upload New Logo
                </button>
              </div>
            </div>
          </section>

          {/* Global Fleet Policies */}
          <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <ShieldCheck className="text-primary" size={20} />
              <h3 className="text-lg font-bold">Global Fleet Policies</h3>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Default Fuel Policy</label>
                  <select 
                    value={settings.fuel_policy}
                    onChange={(e) => handleUpdate({ fuel_policy: e.target.value })}
                    className="w-full px-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Full to Full">Full to Full</option>
                    <option value="Same to Same">Same to Same</option>
                    <option value="Prepaid Fuel">Prepaid Fuel</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Late Return Grace Period (Mins)</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input 
                      type="number" 
                      value={settings.late_return_grace_period}
                      onChange={(e) => setSettings({ ...settings, late_return_grace_period: e.target.value })}
                      onBlur={() => handleUpdate({ late_return_grace_period: Number(settings.late_return_grace_period) })}
                      className="w-full pl-10 pr-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Late Penalty Multiplier</label>
                  <div className="relative">
                    <Zap className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input 
                      type="number" 
                      step="0.1"
                      value={settings.late_return_penalty_multiplier}
                      onChange={(e) => setSettings({ ...settings, late_return_penalty_multiplier: e.target.value })}
                      onBlur={() => handleUpdate({ late_return_penalty_multiplier: Number(settings.late_return_penalty_multiplier) })}
                      className="w-full pl-10 pr-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Financial Configuration */}
          <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Receipt className="text-primary" size={20} />
              <h3 className="text-lg font-bold">Financial Configuration</h3>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                <div>
                  <p className="font-bold text-sm">VAT Configuration</p>
                  <p className="text-xs text-muted-foreground">Enable VAT for your invoices and reports.</p>
                </div>
                <div className="flex items-center gap-4">
                  {settings.vat_status && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">Rate:</span>
                      <input 
                        type="number" 
                        value={settings.vat_rate}
                        onChange={(e) => setSettings({ ...settings, vat_rate: e.target.value })}
                        onBlur={() => handleUpdate({ vat_rate: Number(settings.vat_rate) })}
                        className="w-16 px-2 py-1 bg-card rounded text-xs outline-none"
                      />
                      <span className="text-xs font-bold">%</span>
                    </div>
                  )}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={settings.vat_status}
                      onChange={(e) => handleUpdate({ vat_status: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
              <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-primary uppercase">Platform Commission</p>
                    <p className="text-lg font-black text-primary">{(settings.commission_rate * 100).toFixed(1)}%</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground max-w-[200px] text-right">
                    Standard rate for all fleet owners. Contact support for volume-based discounts.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          {/* Notification Center */}
          <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Bell className="text-primary" size={20} />
              <h3 className="text-lg font-bold">Notification Center</h3>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Booking Alerts', key: 'booking_alerts', desc: 'New requests, cancellations, extensions.' },
                { label: 'Fleet Health', key: 'fleet_health_alerts', desc: 'Service reminders, insurance renewals.' },
                { label: 'Financial Alerts', key: 'financial_alerts', desc: 'Processed payouts, new expenses.' }
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div className="max-w-[180px]">
                    <p className="font-bold text-sm">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={settings[item.key]}
                      onChange={(e) => handleUpdate({ [item.key]: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              ))}
            </div>
          </section>

          {/* Regional & Security */}
          <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Globe className="text-primary" size={20} />
              <h3 className="text-lg font-bold">Regional & Security</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Business Timezone</label>
                <select 
                  value={settings.timezone}
                  onChange={(e) => handleUpdate({ timezone: e.target.value })}
                  className="w-full px-3 py-2 bg-muted rounded-xl text-xs outline-none"
                >
                  <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Preferred Currency</label>
                <select 
                  value={settings.preferred_currency}
                  onChange={(e) => handleUpdate({ preferred_currency: e.target.value })}
                  className="w-full px-3 py-2 bg-muted rounded-xl text-xs outline-none"
                >
                  <option value="KES">KES - Kenyan Shilling</option>
                  <option value="USD">USD - US Dollar</option>
                </select>
              </div>
              <hr className="border-border my-4" />
              <button className="w-full flex items-center justify-between p-3 bg-muted hover:bg-muted/80 rounded-xl transition-colors">
                <div className="flex items-center gap-2">
                  <Lock size={16} className="text-muted-foreground" />
                  <span className="text-xs font-bold">Update Password</span>
                </div>
                <ChevronRight size={14} className="text-muted-foreground" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
