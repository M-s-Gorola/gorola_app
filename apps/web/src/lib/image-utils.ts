export const PRODUCT_PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" fill="none"><rect width="400" height="400" fill="%23F3F4F6"/><path d="M160 140C160 151.046 151.046 160 140 160C128.954 160 120 151.046 120 140C120 128.954 128.954 120 140 120C151.046 120 160 128.954 160 140Z" fill="%239CA3AF"/><path d="M100 280L160 200L220 250L270 180L340 280H100Z" fill="%239CA3AF"/></svg>';

export function extractGoogleDriveFileId(url: string): string | null {
  if (!url) return null;

  // Match /file/d/{ID}/ or /file/d/{ID}
  const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch?.[1]) {
    return fileDMatch[1];
  }

  // Match uc?id={ID} or open?id={ID} or ?id={ID}
  const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch?.[1]) {
    return idParamMatch[1];
  }

  // Match lh3.googleusercontent.com/d/{ID}
  const lh3Match = url.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match?.[1]) {
    return lh3Match[1];
  }

  return null;
}

export function normalizeImageUrl(url?: string | null): string {
  if (!url || typeof url !== "string" || !url.trim()) {
    return PRODUCT_PLACEHOLDER_IMAGE;
  }

  const trimmed = url.trim();

  if (trimmed.includes("drive.google.com") || trimmed.includes("googleusercontent.com")) {
    const fileId = extractGoogleDriveFileId(trimmed);
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }

  return trimmed;
}
