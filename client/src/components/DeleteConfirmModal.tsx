import React, { useState } from 'react';
import { Trash2, AlertTriangle, RefreshCw, X } from 'lucide-react';

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  title?: string;
  itemType?: string;
  itemName?: string;
  itemDetails?: string;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  isDeleting?: boolean;
  isLoading?: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  title = 'Delete Record',
  itemType = 'record',
  itemName,
  itemDetails,
  message = 'Are you sure you want to delete this record?',
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  isDeleting: externalIsDeleting,
  isLoading
}) => {
  const [internalDeleting, setInternalDeleting] = useState(false);
  const isDeleting = externalIsDeleting ?? isLoading ?? internalDeleting;

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setInternalDeleting(true);
      await onConfirm();
    } finally {
      setInternalDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090B]/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-md bg-[#18181B] rounded-2xl shadow-2xl border border-[#3F3F46] overflow-hidden flex flex-col transform transition-all"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#3F3F46] flex items-center justify-between bg-[#111113]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#3F1111] border border-[#7F1D1D] rounded-xl text-[#FF1744]">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F5F5F5]">{title}</h2>
              <p className="text-xs text-[#A1A1AA]">Permanent Database Deletion</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="p-1.5 text-[#71717A] hover:text-[#F5F5F5] rounded-lg hover:bg-[#27272A] transition cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 bg-[#18181B]">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#F5F5F5]">{message}</p>
              <p className="text-xs text-[#A1A1AA]">
                This will permanently delete the {itemType} and its associated files from the database and storage.
              </p>
            </div>
          </div>

          {itemName && (
            <div className="p-3.5 bg-[#111113] border border-[#3F3F46] rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#71717A] uppercase tracking-wider">{itemType}</span>
                <span className="text-xs font-bold text-[#FF1744] font-mono">{itemName}</span>
              </div>
              {itemDetails && (
                <p className="text-[11px] text-[#A1A1AA] font-mono border-t border-[#3F3F46] pt-1 mt-1">
                  {itemDetails}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#111113] border-t border-[#3F3F46] flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-[#F5F5F5] border border-[#52525B] rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-5 py-2 bg-[#B71C1C] hover:bg-[#FF1744] text-[#F5F5F5] rounded-xl text-xs font-bold shadow-md shadow-[#B71C1C]/30 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
