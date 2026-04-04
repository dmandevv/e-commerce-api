// Tests for the multer upload middleware.
// multer handles multipart/form-data file uploads. Our config:
// - memoryStorage: keeps files in RAM (Buffer), not disk
// - fileFilter: only accepts image/* MIME types
// - limits: max 5MB file size

import { describe, it, expect } from "vitest";
import { upload } from "./upload.js";

// ─── multer configuration tests ───────────────────────────────────
// We can't easily test multer middleware as a function (it needs real
// HTTP multipart requests). Instead, we verify the multer instance
// was configured correctly by inspecting its internal properties.

describe("upload middleware (multer config)", () => {
  it("should be defined as a multer instance", () => {
    // upload is the return value of multer({ storage, fileFilter, limits }).
    // It has methods like .single(), .array(), .fields() for different
    // upload strategies. We use .single('image') in the routes.
    expect(upload).toBeDefined();
    expect(upload.single).toBeTypeOf("function");
    expect(upload.array).toBeTypeOf("function");
  });
});

// ─── fileFilter tests ─────────────────────────────────────────────
// The fileFilter function decides which files are accepted.
// We extract and test it directly by calling it with fake file objects.

describe("fileFilter", () => {
  // multer stores the fileFilter internally — we access it to test directly.
  // The filter signature is: (req, file, callback) where callback(null, true)
  // accepts the file and callback(Error) rejects it.
  // @ts-ignore — accessing multer internals for testing
  const fileFilter = (upload as any).fileFilter;

  it("should accept image/jpeg files", () => {
    const callback = (error: any, accepted: boolean) => {
      // null error + true = file accepted
      expect(error).toBeNull();
      expect(accepted).toBe(true);
    };

    // Simulate a JPEG file — mimetype starts with "image/"
    fileFilter(
      {},
      { mimetype: "image/jpeg" } as Express.Multer.File,
      callback
    );
  });

  it("should accept image/png files", () => {
    const callback = (error: any, accepted: boolean) => {
      expect(error).toBeNull();
      expect(accepted).toBe(true);
    };

    fileFilter(
      {},
      { mimetype: "image/png" } as Express.Multer.File,
      callback
    );
  });

  it("should accept image/webp files", () => {
    const callback = (error: any, accepted: boolean) => {
      expect(error).toBeNull();
      expect(accepted).toBe(true);
    };

    fileFilter(
      {},
      { mimetype: "image/webp" } as Express.Multer.File,
      callback
    );
  });

  it("should reject non-image files (application/pdf)", () => {
    const callback = (error: any) => {
      // When rejected, multer receives an Error object (not null).
      // The route handler sees req.file as undefined.
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Only image files are allowed");
    };

    fileFilter(
      {},
      { mimetype: "application/pdf" } as Express.Multer.File,
      callback
    );
  });

  it("should reject text files (text/plain)", () => {
    const callback = (error: any) => {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Only image files are allowed");
    };

    fileFilter(
      {},
      { mimetype: "text/plain" } as Express.Multer.File,
      callback
    );
  });
});
