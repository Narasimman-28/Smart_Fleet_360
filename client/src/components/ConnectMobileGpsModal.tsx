import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Share2, 
  ExternalLink, 
  Radio, 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle, 
  Download, 
  Ban, 
  Smartphone, 
  Truck, 
  Globe, 
  Lock, 
  Unlock 
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import type { Driver } from '../types';
import { resolveDriverImageUrl } from '../utils/imageUrl';

interface ConnectMobileGpsModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: Driver | null;
  onSuccess?: () => void;
}

export const ConnectMobileGpsModal: React.FC<ConnectMobileGpsModalProps> = ({
  isOpen,
  onClose,
  driver,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [tokenData, setTokenData] = useState<{
    token: string;
    trackingUrl: string;
    directUrl?: string;
    lanIp?: string;
    mobileBaseUrl?: string;
    isHttps?: boolean;
    connectionStatus?: string;
    assignedVehicle?: { id: string; vehicle_number: string; make?: string; model?: string } | null;
    activeTrip?: { id: string; booking_number: string } | null;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showTunnelConfig, setShowTunnelConfig] = useState(false);
  const [customHttpsInput, setCustomHttpsInput] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  const fetchOrCreateToken = async () => {
    if (!driver) return;
    setLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/driver-tracking/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: driver.id,
          phone: driver.phone
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate GPS tracking connection.');
      }

      setTokenData(data);
      if (data.mobileBaseUrl && data.isHttps) {
        setCustomHttpsInput(data.mobileBaseUrl);
      }
    } catch (err: any) {
      setError(err.message || 'Error creating driver tracking link.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && driver) {
      fetchOrCreateToken();
    } else {
      setTokenData(null);
      setError(null);
      setStatusMessage(null);
      setCopied(false);
      setShowTunnelConfig(false);
    }
  }, [isOpen, driver]);

  if (!isOpen || !driver) return null;

  const fullTrackingUrl = tokenData?.trackingUrl
    ? (tokenData.trackingUrl.startsWith('http') ? tokenData.trackingUrl : `${window.location.origin}${tokenData.trackingUrl}`)
    : '';

  const isHttps = tokenData?.isHttps ?? (fullTrackingUrl.startsWith('https://') || window.location.protocol === 'https:');

  const handleCopy = async () => {
    if (!fullTrackingUrl) return;
    try {
      await navigator.clipboard.writeText(fullTrackingUrl);
      setCopied(true);
      setStatusMessage('✓ Tracking link copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch {
      setError('Could not copy link to clipboard.');
    }
  };

  const handleOpenLink = () => {
    if (!fullTrackingUrl) return;
    window.open(fullTrackingUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadQR = () => {
    if (!qrCanvasRef.current) return;
    const canvas = qrCanvasRef.current.querySelector('canvas');
    if (!canvas) return;

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `SmartFleet-GPS-${driver.name.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleWhatsApp = () => {
    if (!fullTrackingUrl || !driver.phone) {
      setError('Driver phone number is missing.');
      return;
    }
    const cleanPhone = driver.phone.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(
      `Hello ${driver.name},\nPlease open this link on your mobile phone to start live GPS tracking for SmartFleet 360:\n\n${fullTrackingUrl}\n\n1. Open link\n2. Allow Location permission\n3. Tap START TRACKING`
    );
    window.open(`https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${text}`, '_blank');
  };

  const handleSavePublicUrl = async () => {
    if (!customHttpsInput.trim()) {
      setError('Please enter a valid public HTTPS URL');
      return;
    }
    setSavingUrl(true);
    setError(null);
    try {
      const res = await fetch('/api/driver-tracking/config-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicUrl: customHttpsInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save public URL');
      setStatusMessage('✓ Public HTTPS URL updated!');
      setShowTunnelConfig(false);
      await fetchOrCreateToken();
    } catch (err: any) {
      setError(err.message || 'Failed to update public URL');
    } finally {
      setSavingUrl(false);
    }
  };

  const handleRegenerate = async () => {
    if (!driver) return;
    setActionLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      const token = localStorage.getItem('smartfleet_token');
      const res = await fetch(`/api/driver-tracking/regenerate/${driver.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to regenerate tracking link.');
      }

      setTokenData(data);
      setStatusMessage('✓ New GPS Tracking session generated!');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to regenerate tracking link.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!driver) return;
    if (!window.confirm(`Are you sure you want to disable GPS tracking for ${driver.name}?`)) return;

    setActionLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      const token = localStorage.getItem('smartfleet_token');
      const res = await fetch(`/api/driver-tracking/disable/${driver.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to disable tracking.');
      }

      setStatusMessage('✓ Driver GPS Tracking disabled.');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to disable tracking.');
    } finally {
      setActionLoading(false);
    }
  };

  const vehicleDisplay = driver.assigned_vehicle_number || tokenData?.assignedVehicle?.vehicle_number || 'Unassigned Vehicle';
  const gpsStatusDisplay = driver.tracking_status === 'ACTIVE' || driver.tracking_status === 'CONNECTED'
    ? 'CONNECTED'
    : driver.tracking_status === 'TRACKING DISABLED'
    ? 'TRACKING DISABLED'
    : 'NOT CONNECTED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-[#18181B] border border-[#3F3F46] rounded-3xl shadow-2xl overflow-hidden text-[#F5F5F5] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#3F3F46] flex items-center justify-between bg-[#111113]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#3F1111] border border-[#7F1D1D] flex items-center justify-center text-[#E53935]">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-[#F5F5F5] text-base tracking-tight">
                CONNECT DRIVER GPS (4G / 5G / INTERNET)
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Scan with driver's mobile phone to stream real-time GPS telemetry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#27272A] hover:bg-[#3F3F46] text-[#A1A1AA] hover:text-[#F5F5F5] flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[75vh] bg-[#18181B]">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#E53935] animate-spin mx-auto" />
              <p className="text-[#A1A1AA] font-semibold">Generating secure tracking session token...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-[#3F1111] border border-[#B71C1C] rounded-2xl text-[#FF6B6B] space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-[#F5F5F5]">
                <AlertCircle className="w-4 h-4 text-[#FF1744]" /> Error
              </div>
              <p>{error}</p>
              <button
                onClick={fetchOrCreateToken}
                className="px-3 py-1.5 bg-[#B71C1C] hover:bg-[#E53935] text-[#F5F5F5] rounded-xl font-bold cursor-pointer transition"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {statusMessage && (
                <div className="p-3 bg-[#0F2A1A] border border-[#22C55E] rounded-xl text-[#22C55E] font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#22C55E] shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {/* HTTPS / Public Architecture Status Banner */}
              <div className={`p-3.5 rounded-2xl border space-y-2 transition ${
                isHttps 
                  ? 'bg-[#111113] border-[#22C55E]/40'
                  : 'bg-[#111113] border-[#F59E0B]/40'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    {isHttps ? <Lock className="w-4 h-4 text-[#22C55E]" /> : <Unlock className="w-4 h-4 text-[#F59E0B]" />}
                    <span className={isHttps ? 'text-[#22C55E]' : 'text-[#F59E0B]'}>
                      {isHttps ? 'HTTPS Public Connection: ACTIVE' : 'Public HTTPS Connection Needed for Mobile GPS'}
                    </span>
                  </div>
                  
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isHttps
                      ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/30'
                      : 'bg-[#3A2808] text-[#F59E0B] border border-[#F59E0B]/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isHttps ? 'bg-[#22C55E] animate-ping' : 'bg-[#F59E0B]'}`} />
                    {isHttps ? '4G/5G READY' : 'HTTP LAN'}
                  </span>
                </div>

                <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                  {isHttps ? (
                    <span>
                      ✓ <strong className="text-[#F5F5F5]">Internet Telemetry Ready:</strong> Driver connects over mobile data (4G/5G) from anywhere while travelling. Admin PC sees live movement in real time. No shared Wi-Fi needed.
                    </span>
                  ) : (
                    <span>
                      Mobile browsers block GPS on unencrypted HTTP. Use a public HTTPS domain or an instant HTTPS Cloudflare Tunnel.
                    </span>
                  )}
                </p>

                {/* HTTPS Configuration Drawer Toggle */}
                <div className="pt-1 flex items-center justify-between border-t border-[#3F3F46]">
                  <span className="text-[10px] text-[#71717A]">
                    Public URL: <code className="text-[#60A5FA] font-mono">{tokenData?.mobileBaseUrl || 'Default'}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTunnelConfig(!showTunnelConfig)}
                    className="text-[10px] font-bold text-[#E53935] hover:text-[#FF1744] underline flex items-center gap-1 cursor-pointer"
                  >
                    <Globe className="w-3 h-3" />
                    <span>{showTunnelConfig ? 'Hide Public URL Settings' : 'Configure Public HTTPS URL / Tunnel'}</span>
                  </button>
                </div>

                {/* Public URL Configuration Form */}
                {showTunnelConfig && (
                  <div className="mt-2 pt-2 border-t border-[#3F3F46] space-y-2 bg-[#09090B] p-3 rounded-xl">
                    <span className="text-[11px] font-bold text-[#F5F5F5] block">
                      Set Public HTTPS Domain or Cloudflare Tunnel:
                    </span>
                    <p className="text-[10px] text-[#71717A]">
                      Enter your production domain (e.g. <code className="text-[#22C55E]">https://smartfleet.example.com</code>) or free Cloudflare Tunnel URL:
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customHttpsInput}
                        onChange={(e) => setCustomHttpsInput(e.target.value)}
                        placeholder="https://your-domain.com or https://xxxx.trycloudflare.com"
                        className="w-full bg-[#111113] border border-[#3F3F46] rounded-lg px-2.5 py-1.5 text-xs text-[#22C55E] font-mono focus:outline-hidden focus:border-[#E53935]"
                      />
                      <button
                        type="button"
                        onClick={handleSavePublicUrl}
                        disabled={savingUrl}
                        className="px-3 py-1.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-lg text-xs font-bold shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        {savingUrl ? 'Applying...' : 'Apply'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Driver and Vehicle Meta Card */}
              <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-[#111113] border border-[#3F3F46] rounded-2xl">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#18181B] border border-[#3F3F46] flex items-center justify-center overflow-hidden shrink-0">
                    {resolveDriverImageUrl(driver.profile_image_url || driver.photo_url) ? (
                      <img
                        src={resolveDriverImageUrl(driver.profile_image_url || driver.photo_url)}
                        alt={driver.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-xs font-bold text-[#E53935]">{driver.name ? driver.name.charAt(0).toUpperCase() : 'D'}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">Driver</span>
                    <span className="font-bold text-[#F5F5F5] text-xs truncate block">{driver.name}</span>
                    <span className="text-[10px] text-[#A1A1AA] block truncate">{driver.phone || 'No phone'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">Vehicle</span>
                  <span className="font-mono font-bold text-[#E53935] text-xs truncate block flex items-center gap-1">
                    <Truck className="w-3 h-3 text-[#E53935] shrink-0" />
                    {vehicleDisplay}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider block">GPS Status</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 mt-0.5 rounded-full text-[10px] font-black uppercase ${
                    gpsStatusDisplay === 'CONNECTED'
                      ? 'bg-[#0F2A1A] text-[#22C55E] border border-[#22C55E]/40'
                      : gpsStatusDisplay === 'TRACKING DISABLED'
                      ? 'bg-[#3F1111] text-[#FF1744] border border-[#7F1D1D]'
                      : 'bg-[#27272A] text-[#A1A1AA] border border-[#3F3F46]'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      gpsStatusDisplay === 'CONNECTED' ? 'bg-[#22C55E] animate-ping' : 'bg-[#71717A]'
                    }`} />
                    {gpsStatusDisplay}
                  </span>
                </div>
              </div>

              {/* Real QR Code Presentation */}
              <div className="flex flex-col items-center justify-center p-5 bg-[#111113] border border-[#3F3F46] rounded-3xl space-y-3">
                <div 
                  ref={qrCanvasRef}
                  className="p-4 bg-[#F5F5F5] rounded-2xl shadow-xl border-4 border-[#7F1D1D] flex items-center justify-center"
                >
                  {fullTrackingUrl && (
                    <QRCodeCanvas
                      value={fullTrackingUrl}
                      size={180}
                      level="H"
                      marginSize={1}
                      fgColor="#09090B"
                      bgColor="#F5F5F5"
                    />
                  )}
                </div>

                <div className="text-center space-y-0.5">
                  <p className="font-bold text-[#F5F5F5] text-xs flex items-center justify-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-[#E53935]" />
                    Scan this QR code with the driver's phone camera.
                  </p>
                  <p className="text-[11px] text-[#A1A1AA]">
                    Works anywhere over 4G / 5G / cellular mobile data.
                  </p>
                </div>
              </div>

              {/* Tracking Link Input Field */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-wider block">
                  Public Tracking URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={fullTrackingUrl}
                    className="w-full bg-[#111113] border border-[#3F3F46] rounded-xl px-3 py-2.5 text-xs text-[#F5F5F5] font-mono select-all focus:outline-hidden focus:border-[#E53935]"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`px-3 py-2.5 rounded-xl font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
                      copied
                        ? 'bg-[#E53935] text-[#F5F5F5]'
                        : 'bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] border border-[#3F3F46]'
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons: COPY, OPEN, DOWNLOAD QR, SHARE */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="py-2.5 px-3 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] font-bold rounded-xl border border-[#3F3F46] flex items-center justify-center gap-1.5 cursor-pointer transition text-xs"
                >
                  <Copy className="w-3.5 h-3.5 text-[#E53935]" />
                  <span>Copy Link</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenLink}
                  className="py-2.5 px-3 bg-[#27272A] hover:bg-[#3F3F46] text-[#60A5FA] font-bold rounded-xl border border-[#3F3F46] flex items-center justify-center gap-1.5 cursor-pointer transition text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#60A5FA]" />
                  <span>Open Link</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadQR}
                  className="py-2.5 px-3 bg-[#27272A] hover:bg-[#3F3F46] text-[#22C55E] font-bold rounded-xl border border-[#3F3F46] flex items-center justify-center gap-1.5 cursor-pointer transition text-xs"
                >
                  <Download className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span>Download QR</span>
                </button>

                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="py-2.5 px-3 bg-[#0F2A1A] hover:bg-[#1C4D2E] text-[#22C55E] border border-[#22C55E]/40 font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition text-xs shadow-md"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>

              {/* How it Works Help Box */}
              <div className="bg-[#111113] border border-[#3F3F46] rounded-2xl p-3.5 space-y-1.5 text-[11px] text-[#A1A1AA]">
                <div className="font-bold text-[#F5F5F5] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#22C55E]" /> Real-World Tracking Architecture:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[#D4D4D8]">
                  <li>Driver scans QR code or opens link on their phone using 4G/5G mobile data.</li>
                  <li>Phone opens HTTPS tracking page and taps <strong className="text-[#E53935]">START TRACKING</strong>.</li>
                  <li>Driver grants Location permission; real GPS sensors acquire coordinate fix.</li>
                  <li>Live coordinates stream continuously to SmartFleet 360 backend & Live Map.</li>
                  <li>Admin PC receives instant live marker telemetry via WebSocket from anywhere.</li>
                </ol>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer: REGENERATE, DISABLE, CLOSE */}
        <div className="px-6 py-4 border-t border-[#3F3F46] flex items-center justify-between bg-[#111113]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={actionLoading || loading}
              className="px-3 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-[#3F3F46] cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#E53935] ${actionLoading ? 'animate-spin' : ''}`} />
              <span>Regenerate</span>
            </button>

            <button
              type="button"
              onClick={handleDisable}
              disabled={actionLoading || loading}
              className="px-3 py-2 bg-[#3F1111] hover:bg-[#7F1D1D] text-[#FF1744] rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-[#7F1D1D] cursor-pointer disabled:opacity-50"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Disable</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] border border-[#52525B] rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectMobileGpsModal;
