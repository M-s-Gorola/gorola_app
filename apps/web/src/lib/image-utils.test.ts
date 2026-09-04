import { describe, expect, it } from "vitest";

import { extractGoogleDriveFileId, normalizeImageUrl, PRODUCT_PLACEHOLDER_IMAGE } from "./image-utils";

describe("image-utils", () => {
  describe("extractGoogleDriveFileId", () => {
    it("should extract file ID from /file/d/ format", () => {
      const url = "https://drive.google.com/file/d/1IS7IN6zTLYFnAYUTmvJApgaKlEE/view?usp=sharing";
      expect(extractGoogleDriveFileId(url)).toBe("1IS7IN6zTLYFnAYUTmvJApgaKlEE");
    });

    it("should extract file ID from uc?id= format", () => {
      const url = "https://drive.google.com/uc?id=1IS7IN6zTLYFnAYUTmvJApgaKlEE&export=download";
      expect(extractGoogleDriveFileId(url)).toBe("1IS7IN6zTLYFnAYUTmvJApgaKlEE");
    });

    it("should return null for non-Google Drive URLs", () => {
      const url = "https://images.unsplash.com/photo-12345678";
      expect(extractGoogleDriveFileId(url)).toBeNull();
    });
  });

  describe("normalizeImageUrl", () => {
    it("should transform Google Drive file view URLs to thumbnail endpoint", () => {
      const input = "https://drive.google.com/file/d/1IS7IN6zTLYFnAYUTmvJApgaKlEE/view";
      const expected = "https://drive.google.com/thumbnail?id=1IS7IN6zTLYFnAYUTmvJApgaKlEE&sz=w1000";
      expect(normalizeImageUrl(input)).toBe(expected);
    });

    it("should leave standard non-Google image URLs unchanged", () => {
      const input = "https://images.unsplash.com/photo-12345678";
      expect(normalizeImageUrl(input)).toBe(input);
    });

    it("should return PRODUCT_PLACEHOLDER_IMAGE when given null, undefined, or empty string", () => {
      expect(normalizeImageUrl(null)).toBe(PRODUCT_PLACEHOLDER_IMAGE);
      expect(normalizeImageUrl(undefined)).toBe(PRODUCT_PLACEHOLDER_IMAGE);
      expect(normalizeImageUrl("  ")).toBe(PRODUCT_PLACEHOLDER_IMAGE);
    });
  });
});
