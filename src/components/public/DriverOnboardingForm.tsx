// @ts-nocheck
import React, { useState } from 'react';
import { adminService } from '../../services/adminService';

export function DriverOnboardingForm() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const driver = {
      full_name: formData.get('full_name'),
      email: formData.get('email'),
      phone_number: formData.get('phone_number'),
      license_number: formData.get('license_number'),
    };
    try {
      await adminService.addDriver(driver);
      setSubmitted(true);
    } catch (error) {
      alert('Failed to submit application');
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-4xl font-serif italic mb-4 text-[#FF6B00]">Application Submitted</h1>
        <p className="text-gray-400">Your application is awaiting admin verification.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-serif italic mb-8 text-[#FF6B00]">Driver Onboarding</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 bg-white/5 p-8 rounded-2xl border border-white/10">
        <input name="full_name" placeholder="Full Name" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl" required />
        <input name="email" type="email" placeholder="Email" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl" required />
        <input name="phone_number" placeholder="Phone Number" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl" required />
        <input name="license_number" placeholder="License Number" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl" required />
        <button type="submit" className="w-full py-3 bg-[#FF6B00] rounded-xl font-bold hover:scale-105 transition-transform">Submit Application</button>
      </form>
    </div>
  );
}