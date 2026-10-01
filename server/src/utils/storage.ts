import path from 'path';
import fs from 'fs';

// Resolve uploads root relative to server root
export const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

// Ensure upload subdirectories exist
export const VEHICLES_UPLOADS_DIR = path.join(UPLOADS_ROOT, 'vehicles');
export const DRIVERS_UPLOADS_DIR = path.join(UPLOADS_ROOT, 'drivers');
export const DOCUMENTS_UPLOADS_DIR = path.join(UPLOADS_ROOT, 'documents');

[UPLOADS_ROOT, VEHICLES_UPLOADS_DIR, DRIVERS_UPLOADS_DIR, DOCUMENTS_UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Generate a safe unique filename for vehicle images
 */
export function generateVehicleFilename(vehicleId?: string, originalName?: string): string {
  const ext = originalName ? path.extname(originalName).toLowerCase() : '.jpg';
  const cleanVehicleId = vehicleId ? vehicleId.replace(/[^a-zA-Z0-9_-]/g, '') : 'veh';
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `vehicle_${cleanVehicleId}_${timestamp}_${randomSuffix}${ext}`;
}

/**
 * Safely delete an uploaded file by URL or relative path
 */
export function deleteUploadedFile(fileUrlOrPath?: string | null): boolean {
  if (!fileUrlOrPath) return false;

  try {
    // Extract relative filename/path from /uploads/...
    const cleanPath = fileUrlOrPath.replace(/^\/?uploads\/?/, '');
    const fullPath = path.join(UPLOADS_ROOT, cleanPath);

    // Prevent directory traversal
    if (!fullPath.startsWith(UPLOADS_ROOT)) {
      console.warn(`[Storage] Blocked attempted traversal: ${fileUrlOrPath}`);
      return false;
    }

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      fs.unlinkSync(fullPath);
      console.log(`[Storage] Deleted file: ${fullPath}`);
      return true;
    }
  } catch (err) {
    console.error(`[Storage] Error deleting file ${fileUrlOrPath}:`, err);
  }
  return false;
}

/**
 * Log safe debugging details for file uploads
 */
export function logUploadDebugInfo(info: {
  vehicleId?: string;
  originalName?: string;
  mimetype?: string;
  sizeBytes?: number;
  storedFilename?: string;
  storedPath?: string;
  publicUrl?: string;
}) {
  console.log('==================================================');
  console.log('📸 [Storage Debug] File Upload Event:');
  console.log(`- Vehicle ID:        ${info.vehicleId || 'N/A'}`);
  console.log(`- Image Received:    ${info.storedFilename ? 'YES' : 'NO'}`);
  console.log(`- Original Filename: ${info.originalName || 'N/A'}`);
  console.log(`- MIME Type:         ${info.mimetype || 'N/A'}`);
  console.log(`- File Size:         ${info.sizeBytes ? (info.sizeBytes / 1024).toFixed(1) + ' KB' : 'N/A'}`);
  console.log(`- Stored Filename:   ${info.storedFilename || 'N/A'}`);
  console.log(`- Stored Path:       ${info.storedPath || 'N/A'}`);
  console.log(`- Public URL:        ${info.publicUrl || 'N/A'}`);
  console.log('==================================================');
}
