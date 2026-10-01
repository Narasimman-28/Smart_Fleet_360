import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Truck, User, FileText, AlertTriangle, CreditCard, Shield, ExternalLink } from 'lucide-react';
import { api } from '../services/api';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await api.omnisearch(query);
        setResults(res.results || []);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Vehicle': return <Truck className="w-5 h-5 text-[#FF1744]" />;
      case 'Driver': return <User className="w-5 h-5 text-[#22C55E]" />;
      case 'Insurance Policy': return <Shield className="w-5 h-5 text-[#60A5FA]" />;
      case 'FASTag': return <CreditCard className="w-5 h-5 text-[#F59E0B]" />;
      case 'Traffic Challan': return <AlertTriangle className="w-5 h-5 text-[#FF1744]" />;
      default: return <FileText className="w-5 h-5 text-[#A1A1AA]" />;
    }
  };

  const handleSelect = (url: string) => {
    onClose();
    onNavigate(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-[#09090B]/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-[#18181B] border border-[#3F3F46] rounded-2xl shadow-2xl overflow-hidden">
        {/* Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#3F3F46] bg-[#111113]">
          <Search className="w-5 h-5 text-[#E53935] mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Vehicle Number, Chassis, Engine, Driver, Policy, PUC, FASTag, Challan..."
            className="w-full bg-transparent text-[#F5F5F5] placeholder-[#71717A] focus:outline-none text-base"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 text-[#71717A] hover:text-[#F5F5F5] mr-2">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs text-[#A1A1AA] bg-[#27272A] border border-[#3F3F46] rounded">ESC</kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 bg-[#18181B]">
          {isLoading ? (
            <div className="py-8 text-center text-[#A1A1AA]">Searching global fleet database...</div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              {results.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelect(item.url)}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-[#202024] cursor-pointer transition border border-transparent hover:border-[#7F1D1D]"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-[#111113] rounded-lg border border-[#3F3F46]">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-[#F5F5F5] text-sm">{item.title}</span>
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-[#3F1111] text-[#FF6B6B] rounded border border-[#7F1D1D]">{item.category}</span>
                      </div>
                      <p className="text-xs text-[#A1A1AA] mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#71717A] hover:text-[#FF1744] shrink-0 ml-2" />
                </div>
              ))}
            </div>
          ) : query.trim() ? (
            <div className="py-8 text-center text-[#A1A1AA]">
              No matching vehicle, document, or record found for "<span className="text-[#F5F5F5] font-medium">{query}</span>"
            </div>
          ) : (
            <div className="py-6 px-4 text-xs text-[#71717A] space-y-2">
              <p className="font-medium text-[#A1A1AA]">Quick suggestions:</p>
              <div className="flex flex-wrap gap-2">
                {['TN-01-AB-1234', 'MH-12-CD-5678', 'DL-03-EF-9012', 'Gurpreet Singh', 'Tata AIG', 'ICICI FASTag'].map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setQuery(s)}
                    className="px-2.5 py-1 bg-[#27272A] hover:bg-[#3F1818] hover:text-[#FF1744] hover:border-[#7F1D1D] text-[#A1A1AA] rounded-lg border border-[#3F3F46] text-xs transition cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchModal;
