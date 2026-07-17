import React, { createContext, useContext, useEffect } from 'react';

interface PublicThemeContextType {
  theme: 'dark';
}

const PublicThemeContext = createContext<PublicThemeContextType | undefined>(undefined);

export function PublicThemeProvider({ children }: { children: React.ReactNode }) {
  // Force dark mode permanently
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light');
    root.classList.add('dark');
    // Remove any saved theme preference
    localStorage.removeItem('public-theme');
  }, []);

  return (
    <PublicThemeContext.Provider value={{ theme: 'dark' }}>
      {children}
    </PublicThemeContext.Provider>
  );
}

export function usePublicTheme() {
  const context = useContext(PublicThemeContext);
  if (context === undefined) {
    throw new Error('usePublicTheme must be used within a PublicThemeProvider');
  }
  return context;
}
