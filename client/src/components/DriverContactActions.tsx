import React, { useState } from 'react';
import { Phone, MessageSquare, Copy, Check } from 'lucide-react';

interface DriverContactActionsProps {
  phone?: string;
  driverName?: string;
  size?: 'sm' | 'md' | 'lg';
  showNumber?: boolean;
  className?: string;
}

export const DriverContactActions: React.FC<DriverContactActionsProps> = ({
  phone,
  driverName = 'Driver',
  size = 'md',
  showNumber = true,
  className = ''
}) => {
  const [copied, setCopied] = useState(false);

  if (!phone || phone.trim() === '') {
    return (
      <span className="text-xs text-[#71717A] italic">No phone registered</span>
    );
  }

  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  const waPhone = cleanPhone.startsWith('+') ? cleanPhone.replace('+', '') : cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSmall = size === 'sm';
  const iconSize = isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const btnPadding = isSmall ? 'p-1' : 'p-1.5';

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {showNumber && (
        <span className={`font-mono font-semibold text-[#F5F5F5] ${isSmall ? 'text-[11px]' : 'text-xs'}`}>
          {phone}
        </span>
      )}

      {/* Call Button */}
      <a
        href={`tel:${cleanPhone}`}
        onClick={(e) => e.stopPropagation()}
        title={`Call ${driverName} (${phone})`}
        className={`${btnPadding} rounded-lg bg-[#0F2A1A] hover:bg-[#163c25] text-[#22C55E] border border-[#22C55E]/40 transition shadow-xs inline-flex items-center justify-center`}
      >
        <Phone className={iconSize} />
      </a>

      {/* WhatsApp Message Button */}
      <a
        href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`Hello ${driverName}, message from SmartFleet 360 Fleet Dispatch.`)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={`WhatsApp message to ${driverName}`}
        className={`${btnPadding} rounded-lg bg-[#0F2A1A] hover:bg-[#163c25] text-[#22C55E] border border-[#22C55E]/40 transition shadow-xs inline-flex items-center justify-center`}
      >
        <MessageSquare className={iconSize} />
      </a>

      {/* Copy Phone Number */}
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? 'Copied to clipboard!' : `Copy phone number (${phone})`}
        className={`${btnPadding} rounded-lg ${
          copied 
            ? 'bg-[#E53935] text-[#F5F5F5] border border-[#E53935]' 
            : 'bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] border border-[#3F3F46]'
        } transition shadow-xs inline-flex items-center justify-center cursor-pointer`}
      >
        {copied ? <Check className={iconSize} /> : <Copy className={iconSize} />}
      </button>
    </div>
  );
};
