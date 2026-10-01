import React from 'react';
import type { TimelineEvent } from '../types';
import { Truck, Wrench, Fuel, Calendar, AlertTriangle, FileText } from 'lucide-react';

interface VehicleTimelineProps {
  events?: TimelineEvent[];
}

export const VehicleTimeline: React.FC<VehicleTimelineProps> = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <div className="py-12 text-center text-[#71717A]">
        No recorded lifecycle events found for this vehicle.
      </div>
    );
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'REGISTRATION': return <Truck className="w-4 h-4 text-[#E53935]" />;
      case 'SERVICE': return <Wrench className="w-4 h-4 text-[#22C55E]" />;
      case 'FUEL': return <Fuel className="w-4 h-4 text-[#F59E0B]" />;
      case 'BOOKING': return <Calendar className="w-4 h-4 text-[#60A5FA]" />;
      case 'CHALLAN': return <AlertTriangle className="w-4 h-4 text-[#FF1744]" />;
      default: return <FileText className="w-4 h-4 text-[#A1A1AA]" />;
    }
  };

  const getBadgeClass = (type: string) => {
    switch (type) {
      case 'REGISTRATION': return 'bg-[#3F1111] text-[#FF6B6B] border-[#7F1D1D]';
      case 'SERVICE': return 'bg-[#0F2A1A] text-[#22C55E] border-[#22C55E]/40';
      case 'FUEL': return 'bg-[#3A2808] text-[#F59E0B] border-[#F59E0B]/40';
      case 'BOOKING': return 'bg-[#18181B] text-[#60A5FA] border-[#3F3F46]';
      case 'CHALLAN': return 'bg-[#3F1111] text-[#FF1744] border-[#B71C1C]';
      default: return 'bg-[#27272A] text-[#D4D4D8] border-[#3F3F46]';
    }
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#3F3F46]">
      {events.map((event, idx) => (
        <div key={idx} className="relative group">
          {/* Timeline Dot */}
          <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#111113] border-2 border-[#E53935] flex items-center justify-center group-hover:scale-110 transition shadow-sm shadow-[#E53935]/30">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF1744]" />
          </div>

          {/* Card */}
          <div className="p-4 rounded-xl bg-[#18181B] border border-[#3F3F46] hover:border-[#7F1D1D] transition shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <div className="flex items-center space-x-2">
                <div className="p-1 rounded bg-[#111113] border border-[#3F3F46]">
                  {getEventIcon(event.type)}
                </div>
                <h4 className="font-semibold text-[#F5F5F5] text-xs sm:text-sm">{event.title || 'Fleet Event'}</h4>
              </div>
              <div className="flex items-center space-x-2">
                {event.badge && (
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${getBadgeClass(event.type)}`}>
                    {event.badge}
                  </span>
                )}
                <span className="text-[11px] text-[#71717A] font-mono">{event.date || 'N/A'}</span>
              </div>
            </div>
            <p className="text-xs text-[#A1A1AA] leading-relaxed mt-1">{event.description || ''}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
