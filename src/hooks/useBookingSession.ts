import { useState, useEffect } from 'react';

type BookingSessionData = Record<string, any>;

interface BookingSession {
  bookingData: Partial<BookingSessionData>;
  currentStep: number;
  timestamp: number;
}

const SESSION_KEY = 'linkedup_booking_session';
const SESSION_EXPIRY = 30 * 60 * 1000; // 30 minutes

export function useBookingSession() {
  const [session, setSession] = useState<BookingSession | null>(null);

  // Load session on mount
  useEffect(() => {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        const parsed: BookingSession = JSON.parse(savedSession);
        // Check if session is still valid
        if (Date.now() - parsed.timestamp < SESSION_EXPIRY) {
          setSession(parsed);
        } else {
          // Clear expired session
          localStorage.removeItem(SESSION_KEY);
        }
      } catch (error) {
        console.error('Error parsing booking session:', error);
        localStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  const saveSession = (bookingData: Partial<BookingSessionData>, currentStep: number) => {
    const newSession: BookingSession = {
      bookingData,
      currentStep,
      timestamp: Date.now()
    };
    
    setSession(newSession);
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
  };

  const clearSession = () => {
    setSession(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const isSessionValid = () => {
    return session && (Date.now() - session.timestamp < SESSION_EXPIRY);
  };

  return {
    session,
    saveSession,
    clearSession,
    isSessionValid: isSessionValid()
  };
}
