import React, { useState, useRef, useEffect } from 'react';
import { X, Eye, Image as ImageIcon, AlertCircle, RefreshCw, Loader2, User, FileText, Upload, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { resolveVehicleImageUrl } from '../utils/imageUrl';

interface ImageUploaderProps {
  label: string;
  subLabel?: string;
  value?: string;
  onChange: (url: string) => void;
  onFileChange?: (file: File | null) => void;
  type?: 'vehicle' | 'driver' | 'document';
  aspectRatio?: 'video' | 'square' | 'wide';
  required?: boolean;
  disabled?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  label,
  subLabel,
  value,
  onChange,
  onFileChange,
  type = 'vehicle',
  aspectRatio = 'video',
  required = false,
  disabled = false
}) => {
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up any generated blob URL on unmount
  useEffect(() => {
    return () => {
      if (localPreviewUrl && localPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const handleFileSelect = async (file: File) => {
    setUploadError(null);
    setImageLoadError(false);

    // Validate type: JPG, JPEG, PNG, WEBP
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const fileName = file.name.toLowerCase();
    const isExtensionValid = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png') || fileName.endsWith('.webp');

    if (!validTypes.includes(file.type.toLowerCase()) && !isExtensionValid) {
      setUploadError('Please upload JPG, PNG, JPEG, or WEBP image.');
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be smaller than 5 MB.');
      return;
    }

    // 1. Immediately create local preview URL for 0ms instant display
    if (localPreviewUrl && localPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    const blobPreview = URL.createObjectURL(file);
    setLocalPreviewUrl(blobPreview);
    setImageLoadError(false);
    onFileChange?.(file);

    // 2. Upload file to backend server storage
    try {
      setIsUploading(true);
      const res = await api.uploadImage(file);
      onChange(res.url);
    } catch (err: any) {
      setUploadError(err.message || 'Image upload failed. Please try again.');
      if (blobPreview.startsWith('blob:')) {
        URL.revokeObjectURL(blobPreview);
      }
      setLocalPreviewUrl(null);
      onFileChange?.(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (localPreviewUrl && localPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    setLocalPreviewUrl(null);
    onFileChange?.(null);
    onChange('');
    setUploadError(null);
    setImageLoadError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displayImageUrl = localPreviewUrl || resolveVehicleImageUrl(value);

  const getAspectClass = () => {
    if (aspectRatio === 'square') return 'aspect-square max-w-[180px]';
    if (aspectRatio === 'wide') return 'aspect-[16/9]';
    return 'aspect-[4/3]';
  };

  const renderPlaceholderIcon = () => {
    if (type === 'driver') return <User className="w-8 h-8 text-[#A1A1AA]" />;
    if (type === 'document') return <FileText className="w-8 h-8 text-[#A1A1AA]" />;
    return <ImageIcon className="w-8 h-8 text-[#E53935]" />;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-[#F5F5F5] flex items-center gap-1">
          {label}
          {required && <span className="text-[#FF1744]">*</span>}
        </label>
        {subLabel && (
          <span className="text-[10px] text-[#A1A1AA] font-medium">{subLabel}</span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleInputChange}
        disabled={disabled || isUploading}
        className="hidden"
      />

      {displayImageUrl ? (
        <div className="space-y-2">
          {/* Image Display Frame */}
          <div className="relative group rounded-2xl overflow-hidden border border-[#3F3F46] bg-[#111113] shadow-md">
            <div className={`${getAspectClass()} w-full relative flex items-center justify-center bg-[#09090B] overflow-hidden`}>
              {!imageLoadError ? (
                <img
                  src={displayImageUrl}
                  alt={label}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={() => setImageLoadError(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center text-[#71717A]">
                  <AlertCircle className="w-8 h-8 text-[#FF1744] mb-1" />
                  <span className="text-xs font-bold text-[#F5F5F5]">
                    {type === 'driver' ? 'Driver image unavailable' : type === 'document' ? 'Document unavailable' : 'Vehicle image unavailable'}
                  </span>
                  <span className="text-[10px] text-[#71717A] mt-0.5">The image could not be loaded</span>
                </div>
              )}

              {isUploading && (
                <div className="absolute inset-0 bg-[#09090B]/80 backdrop-blur-xs flex flex-col items-center justify-center text-[#F5F5F5] p-2 z-20">
                  <Loader2 className="w-7 h-7 animate-spin mb-1.5 text-[#E53935]" />
                  <span className="text-xs font-bold">Saving image...</span>
                </div>
              )}
            </div>

            {/* Action Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090B]/90 via-[#09090B]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3 z-10">
              <div className="flex items-center gap-1.5">
                {!imageLoadError && (
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(true)}
                    className="px-2.5 py-1.5 bg-[#27272A]/80 hover:bg-[#3F3F46] text-[#F5F5F5] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="Preview full size"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isUploading}
                  className="px-2.5 py-1.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-lg shadow-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Change image"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Change Image</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled || isUploading}
                className="p-1.5 bg-[#B71C1C] hover:bg-[#FF1744] text-[#F5F5F5] rounded-lg transition cursor-pointer shadow-sm"
                title="Remove image"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Visible action bar for mobile & accessibility */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
                className="px-3 py-1.5 bg-[#18181B] hover:bg-[#202024] text-[#F5F5F5] border border-[#3F3F46] rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#E53935]" />
                <span>Change Image</span>
              </button>
              {!imageLoadError && (
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="px-3 py-1.5 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] border border-[#3F3F46] rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled || isUploading}
              className="px-3 py-1.5 bg-[#3F1111] hover:bg-[#7F1D1D] text-[#FF6B6B] border border-[#7F1D1D] rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Image</span>
            </button>
          </div>
        </div>
      ) : (
        /* Empty Upload Dropzone */
        <div
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!disabled && !isUploading) setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-200
            ${getAspectClass()} w-full flex flex-col items-center justify-center
            ${isDragging 
              ? 'border-[#E53935] bg-[#3F1111]/40' 
              : 'border-[#3F3F46] bg-[#111113] hover:border-[#E53935] hover:bg-[#18181B]'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isUploading ? (
            <div className="flex flex-col items-center justify-center text-[#E53935]">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <span className="text-xs font-bold">
                {type === 'driver' ? 'Uploading driver image...' : type === 'document' ? 'Uploading document...' : 'Uploading vehicle image...'}
              </span>
              <span className="text-[10px] text-[#A1A1AA] mt-0.5">Please wait</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#18181B] border border-[#3F3F46] flex items-center justify-center shadow-xs">
                {renderPlaceholderIcon()}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-[#F5F5F5]">
                  {type === 'driver' ? 'Driver Profile Image' : type === 'vehicle' ? 'Vehicle Image' : 'Select Image'}
                </p>
                <p className="text-[11px] text-[#A1A1AA]">
                  JPG, JPEG, PNG, WEBP (Max 5 MB)
                </p>
              </div>

              <div className="pt-1">
                <span className="px-3.5 py-1.5 bg-[#E53935] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-lg shadow-[#E53935]/20 inline-flex items-center gap-1.5 transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Image</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {uploadError && (
        <div className="p-2.5 bg-[#3F1111] border border-[#B71C1C] rounded-xl text-xs text-[#FF6B6B] font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#FF1744] shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Full Size Preview Modal */}
      {isPreviewOpen && displayImageUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div 
            className="relative max-w-4xl w-full max-h-[90vh] bg-[#18181B] rounded-2xl overflow-hidden shadow-2xl border border-[#3F3F46]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-[#111113] text-[#F5F5F5] flex items-center justify-between border-b border-[#3F3F46]">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#E53935]" />
                <span className="text-sm font-bold">{label} Preview</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#202024] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 flex items-center justify-center bg-[#09090B] max-h-[75vh] overflow-auto">
              <img
                src={displayImageUrl}
                alt={label}
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
