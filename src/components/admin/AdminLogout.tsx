import React, { useEffect } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function AdminLogout() {
  useEffect(() => {
    const handleLogout = async () => {
      try {
        await supabase.auth.signOut();
        // Redirect to home after a short delay to show the logout animation
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } catch (error) {
        console.error('Error logging out:', error);
        window.location.href = '/';
      }
    };

    handleLogout();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-in fade-in duration-150">
      <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 relative">
        <LogOut size={40} />
        <div className="absolute -bottom-2 -right-2 bg-card p-1 rounded-full border border-border">
          <Loader2 size={20} className="text-primary animate-spin" />
        </div>
      </div>
      <h3 className="text-2xl font-bold mb-2">Logging out...</h3>
      <p className="text-muted-foreground max-w-xs">
        Thank you for using Linkedup Cars Rentals Admin Command. You are being securely signed out.
      </p>
    </div>
  );
}
