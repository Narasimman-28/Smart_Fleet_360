/**
 * Vehicle & Profile Image URL Resolver for SmartFleet 360
 * Handles local blob preview, relative /uploads URLs, absolute URLs, and clean null fallbacks.
 */

export function resolveVehicleImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return '';

  // 1. Temporary local preview object URL (blob:) or base64 (data:)
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // 2. Absolute URL (http:// or https://)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // Sanitize any accidental doubled origin like http://localhost:5000http://localhost:5000/uploads/...
    const matchDouble = trimmed.match(/(https?:\/\/[^\/]+)(https?:\/\/[^\/]+.*)/);
    if (matchDouble) {
      return matchDouble[2];
    }
    return trimmed;
  }

  // 3. Relative /uploads/... URL
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return cleanPath;
  }

  // Default return with leading slash if path
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export const resolveDriverImageUrl = resolveVehicleImageUrl;
export const resolveImageUrl = resolveVehicleImageUrl;
export default resolveVehicleImageUrl;
