import React, { useEffect, useState } from 'react';
import { clientService } from '../../services/clientService';
import { useAuth } from '../../contexts/AuthContext';
import { User, Heart, Settings as SettingsIcon, History, Save, Trash2, Car, MapPin, CreditCard, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function MyProfile() {
  const { user, profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [preferences, setPreferences] = useState<any>({
    preferred_pickup_location: '',
    preferred_dropoff_location: '',
    default_payment_method: 'ncba_stk',
    always_include_chauffeur: false
  });
  const [extraDetails, setExtraDetails] = useState({
    id_number: '',
    license_number: ''
  });
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchData();
  }, [user, authProfile]);

  const fetchData = async () => {
    try {
      if (user) {
        const [prefs, wish, bks] = await Promise.all([
          clientService.getPreferences(user.id),
          clientService.getWishlist(user.id),
          clientService.getAllBookings(user.id)
        ]);

        setProfile(authProfile);
        if (prefs) setPreferences(prefs);
        setWishlist(wish || []);
        setBookings(bks || []);

        // Fetch extra profile details (id_number, license_number) if any exist
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('id_number, license_number')
          .eq('id', user.id)
          .single();
        if (profileData) {
          setExtraDetails({
            id_number: profileData.id_number || '',
            license_number: profileData.license_number || ''
          });
        }
      }
    } catch (err) {
      console.error("Error fetching profile data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await clientService.updateProfile(profile.id, {
        full_name: profile.full_name,
        phone_number: profile.phone_number,
        address: profile.address,
        id_number: extraDetails.id_number,
        license_number: extraDetails.license_number
      });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const handlePreferencesUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await clientService.updatePreferences(profile.id, preferences);
      setMessage({ type: 'success', text: 'Preferences updated successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update preferences.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const handleRemoveFromWishlist = async (carId: string) => {
    try {
      await clientService.removeFromWishlist(profile.id, carId);
      setWishlist(wishlist.filter(item => item.car_id !== carId));
    } catch (err) {
      console.error("Error removing from wishlist:", err);
    }
  };

  if (loading) return <div className="p-8">Loading profile...</div>;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Profile & Smart Preferences</h2>
        {message.text && (
          <div className={`px-4 py-2 rounded-xl text-sm font-bold animate-in fade-in slide-in-from-top-2 ${
            message.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile & Preferences */}
        <div className="lg:col-span-2 space-y-8">
          {/* Personal Information */}
          <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <User className="text-primary" size={20} />
              <h3 className="text-lg font-semibold">Personal Information</h3>
            </div>
            <form onSubmit={handleProfileUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Full Name</label>
                <input
                  type="text"
                  value={profile?.full_name || ''}
                  onChange={(e) => setProfile({...profile, full_name: e.target.value})}
                  className="w-full px-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Email Address</label>
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="w-full px-4 py-2 bg-muted/50 rounded-xl text-sm outline-none cursor-not-allowed"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Phone Number</label>
                <input
                  type="text"
                  value={profile?.phone_number || ''}
                  onChange={(e) => setProfile({...profile, phone_number: e.target.value})}
                  className="w-full px-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Address</label>
                <input
                  type="text"
                  value={profile?.address || ''}
                  onChange={(e) => setProfile({...profile, address: e.target.value})}
                  className="w-full px-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">National ID Number</label>
                <input
                  type="text"
                  value={extraDetails.id_number}
                  onChange={(e) => setExtraDetails({...extraDetails, id_number: e.target.value})}
                  className="w-full px-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Driver's License Number</label>
                <input
                  type="text"
                  value={extraDetails.license_number}
                  onChange={(e) => setExtraDetails({...extraDetails, license_number: e.target.value})}
                  className="w-full px-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>

          {/* Default Booking Settings */}
          <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <SettingsIcon className="text-primary" size={20} />
              <h3 className="text-lg font-semibold">Default Booking Settings</h3>
            </div>
            <form onSubmit={handlePreferencesUpdate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Preferred Pickup Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input
                      type="text"
                      placeholder="e.g. Jomo Kenyatta Airport"
                      value={preferences.preferred_pickup_location || ''}
                      onChange={(e) => setPreferences({...preferences, preferred_pickup_location: e.target.value})}
                      className="w-full pl-10 pr-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Preferred Drop-off Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input
                      type="text"
                      placeholder="e.g. Nairobi CBD"
                      value={preferences.preferred_dropoff_location || ''}
                      onChange={(e) => setPreferences({...preferences, preferred_dropoff_location: e.target.value})}
                      className="w-full pl-10 pr-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Default Payment Method</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <select
                      value={preferences.default_payment_method || 'ncba_stk'}
                      onChange={(e) => setPreferences({...preferences, default_payment_method: e.target.value})}
                      className="w-full pl-10 pr-4 py-2 bg-muted rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                    >
                      <option value="ncba_stk">NCBA STK Push</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={preferences.always_include_chauffeur}
                      onChange={(e) => setPreferences({...preferences, always_include_chauffeur: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                  <span className="text-sm font-bold">Always include Chauffeur</span>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          </section>

          {/* Activity Timeline */}
          <section className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <History className="text-primary" size={20} />
              <h3 className="text-lg font-semibold">Activity Timeline</h3>
            </div>
            <div className="space-y-6 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {bookings.slice(0, 5).map((booking, idx) => (
                <div key={booking.id} className="relative pl-8">
                  <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-background ${
                    booking.status === 'completed' ? 'bg-green-500' :
                    (booking.status === 'on_trip' || booking.status === 'in_progress') ? 'bg-primary' : 'bg-blue-500'
                  }`} />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <p className="text-sm font-bold">
                        {booking.status === 'completed' ? 'Completed rental of' :
                         (booking.status === 'on_trip' || booking.status === 'in_progress') ? 'Currently driving' : 'Booked'} {booking.cars.make} {booking.cars.model}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}</p>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2 py-1 rounded-lg">
                      {booking.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
              {bookings.length === 0 && (
                <p className="text-sm text-muted-foreground pl-8">No activity history yet.</p>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Wishlist */}
        <div className="space-y-8">
          <section className="bg-card p-6 rounded-2xl border border-border shadow-sm h-full">
            <div className="flex items-center gap-2 mb-6">
              <Heart className="text-primary" size={20} />
              <h3 className="text-lg font-semibold">Saved Cars / Wishlist</h3>
            </div>
            <div className="space-y-4">
              {wishlist.length > 0 ? (
                wishlist.map((item) => (
                  <div key={item.id} className="group p-4 border border-border rounded-xl hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                        {item.cars.primary_image_url ? (
                          <img src={item.cars.primary_image_url} alt={item.cars.model} className="w-full h-full object-cover" />
                        ) : (
                          <Car className="text-muted-foreground" size={20} />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold">{item.cars.make} {item.cars.model}</p>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${item.cars.status === 'available' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <p className="text-[10px] text-muted-foreground capitalize">{item.cars.status}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFromWishlist(item.car_id)}
                        className="p-2 text-muted-foreground hover:text-error transition-colors"
                        title="Remove from favorites"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <button className="w-full py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors">
                      Book Now
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Heart className="mx-auto text-muted-foreground/30 mb-2" size={32} />
                  <p className="text-xs text-muted-foreground">Your wishlist is empty.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
