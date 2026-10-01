import React, { useState, useEffect } from 'react';
import { X, Camera, AlertCircle, RefreshCw, Save, Trash2, CheckCircle2 } from 'lucide-react';
import type { Vehicle } from '../types';
import { api } from '../services/api';
import { ImageUploader } from './ImageUploader';

interface UpdateVehicleImageModalProps {
  isOpen: boolean;
  vehicle: Vehicle;
  onClose: () => void;
  onSuccess: () => void;
}

export const UpdateVehicleImageModal: React.FC<UpdateVehicleImageModalProps> = ({
  isOpen,
  vehicle,
  onClose,
  onSuccess
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (vehicle && isOpen) {
      setImageUrl(vehicle.profile_image_url || vehicle.photo_url || '');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [vehicle, isOpen]);

  if (!isOpen || !vehicle) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const cleanUrl = imageUrl.trim() || null;
      await api.updateVehicleImage(vehicle.id, cleanUrl);
      setSuccessMsg(cleanUrl ? 'Vehicle profile image updated successfully!' : 'Vehicle profile image removed.');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update vehicle profile image');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveDirect = async () => {
    setImageUrl('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg bg-[#18181B] rounded-2xl shadow-2xl border border-[#3F3F46] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#3F3F46] flex items-center justify-between bg-[#111113]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#3F1111] border border-[#7F1D1D] rounded-xl text-[#E53935]">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F5F5F5]">Vehicle Profile Image</h2>
              <p className="text-xs text-[#A1A1AA] font-mono">{vehicle.vehicle_number} • {vehicle.make} {vehicle.model}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#A1A1AA] hover:text-[#F5F5F5] rounded-lg hover:bg-[#202024] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 bg-[#18181B]">
          {errorMsg && (
            <div className="p-3 bg-[#3F1111] border border-[#B71C1C] rounded-xl text-[#FF6B6B] text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#FF1744]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-[#0F2A1A] border border-[#22C55E] rounded-xl text-[#22C55E] text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#22C55E]" />
              <span>{successMsg}</span>
            </div>
          )}

          <ImageUploader
            label="Upload, Change or Remove Vehicle Photo"
            subLabel="JPG, PNG, WEBP (Max 5 MB)"
            value={imageUrl}
            onChange={(url) => setImageUrl(url)}
            type="vehicle"
            aspectRatio="wide"
          />
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#111113] border-t border-[#3F3F46] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] border border-[#52525B] rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {imageUrl && (
              <button
                type="button"
                onClick={handleRemoveDirect}
                className="px-3.5 py-2 bg-[#3F1111] hover:bg-[#7F1D1D] text-[#FF1744] border border-[#7F1D1D] rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Image</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Image</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateVehicleImageModal;
