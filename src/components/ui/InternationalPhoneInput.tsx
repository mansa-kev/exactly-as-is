import React from 'react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

interface InternationalPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

export function InternationalPhoneInput({
  value,
  onChange,
  required = false,
  className = '',
  placeholder = 'Phone Number'
}: InternationalPhoneInputProps) {
  return (
    <div className={`international-phone-container ${className}`}>
      <PhoneInput
        international
        defaultCountry="KE"
        value={value}
        onChange={(val) => onChange(val || '')}
        required={required}
        placeholder={placeholder}
        className="flex w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus-within:border-primary transition-colors"
        style={{ '--PhoneInputCountrySelectArrow-color': 'currentColor' } as React.CSSProperties}
      />
    </div>
  );
}
