// Tests for the Cloudinary utility: uploadImage, deleteImage.
// These functions handle uploading product images to Cloudinary's CDN
// and deleting them when an admin removes an image.

// ─── Why we mock Cloudinary ──────────────────────────────────────
// The real Cloudinary SDK sends HTTP requests to Cloudinary's servers.
// In unit tests we don't want to: (a) hit a real API, (b) need credentials,
// (c) wait for network I/O. We mock the SDK to verify our code calls
// the right methods with the right arguments.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Cloudinary SDK ──────────────────────────────────────────
// cloudinary.ts imports { v2 as cloudinary } from 'cloudinary'.
// We replace the entire module so no real HTTP calls are made.

// vi.hoisted() creates these before vi.mock runs (same pattern as cache tests).
const { mockUploadStream, mockDestroy, mockConfig } = vi.hoisted(() => ({
  // upload_stream returns a writable stream — we mock it to call the
  // callback immediately with a fake result (simulating a successful upload).
  mockUploadStream: vi.fn(),
  // destroy() deletes an image by publicId — we mock it to resolve immediately.
  mockDestroy: vi.fn(),
  // config() sets Cloudinary credentials — we mock it to do nothing.
  mockConfig: vi.fn(),
}));

vi.mock("cloudinary", () => ({
  // The real import is: import { v2 as cloudinary } from 'cloudinary'
  // So we need to provide a v2 object with the same shape.
  v2: {
    config: mockConfig,
    uploader: {
      upload_stream: mockUploadStream,
      destroy: mockDestroy,
    },
  },
}));

import { uploadImage, deleteImage } from "./cloudinary.js";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── uploadImage ───────────────────────────────────────────────────

describe("uploadImage", () => {
  it("should upload a buffer and return publicId + url", async () => {
    // Simulate Cloudinary's upload_stream behavior:
    // It returns a writable stream and accepts a callback.
    // The callback fires with (error, result) when upload completes.
    mockUploadStream.mockImplementation((options: any, callback: Function) => {
      // Call the callback with a successful result — this is what
      // Cloudinary returns after processing the image.
      callback(null, {
        public_id: "ecommerce/products/abc123",
        secure_url: "https://res.cloudinary.com/demo/image/upload/v1/ecommerce/products/abc123.jpg",
      });

      // Return a fake writable stream with an end() method.
      // uploadImage() calls stream.end(buffer) to send the raw bytes.
      return { end: vi.fn() };
    });

    const buffer = Buffer.from("fake-image-bytes");
    const result = await uploadImage(buffer);

    // Verify the function returns the correct shape
    expect(result).toEqual({
      publicId: "ecommerce/products/abc123",
      url: "https://res.cloudinary.com/demo/image/upload/v1/ecommerce/products/abc123.jpg",
    });

    // Verify upload_stream was called with correct options
    expect(mockUploadStream).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: "ecommerce/products",  // Default folder for product images
        resource_type: "image",         // Process as image (not video/raw)
      }),
      expect.any(Function) // The callback
    );
  });

  it("should accept a custom folder", async () => {
    mockUploadStream.mockImplementation((options: any, callback: Function) => {
      callback(null, {
        public_id: "custom/folder/xyz",
        secure_url: "https://res.cloudinary.com/demo/image/upload/v1/custom/folder/xyz.jpg",
      });
      return { end: vi.fn() };
    });

    const buffer = Buffer.from("fake-image-bytes");
    await uploadImage(buffer, "custom/folder");

    // The folder option should reflect the custom path
    expect(mockUploadStream).toHaveBeenCalledWith(
      expect.objectContaining({ folder: "custom/folder" }),
      expect.any(Function)
    );
  });

  it("should reject when Cloudinary returns an error", async () => {
    mockUploadStream.mockImplementation((options: any, callback: Function) => {
      // Simulate a Cloudinary error (e.g., invalid credentials, quota exceeded)
      callback(new Error("Upload quota exceeded"));
      return { end: vi.fn() };
    });

    const buffer = Buffer.from("fake-image-bytes");

    // uploadImage wraps the callback in a Promise — errors become rejections
    await expect(uploadImage(buffer)).rejects.toThrow("Upload quota exceeded");
  });

  it("should reject when Cloudinary returns no result", async () => {
    mockUploadStream.mockImplementation((options: any, callback: Function) => {
      // Edge case: no error but also no result (shouldn't happen, but defensive)
      callback(null, null);
      return { end: vi.fn() };
    });

    const buffer = Buffer.from("fake-image-bytes");

    await expect(uploadImage(buffer)).rejects.toThrow("Upload failed");
  });

  it("should write the buffer to the upload stream", async () => {
    const mockEnd = vi.fn();

    mockUploadStream.mockImplementation((options: any, callback: Function) => {
      callback(null, {
        public_id: "ecommerce/products/test",
        secure_url: "https://example.com/test.jpg",
      });
      // Return a stream with a spy on end() so we can verify the buffer was sent
      return { end: mockEnd };
    });

    const buffer = Buffer.from("image-data-here");
    await uploadImage(buffer);

    // stream.end(buffer) sends the raw bytes and signals "done sending data"
    expect(mockEnd).toHaveBeenCalledWith(buffer);
  });
});

// ─── deleteImage ───────────────────────────────────────────────────

describe("deleteImage", () => {
  it("should call Cloudinary destroy with the publicId", async () => {
    mockDestroy.mockResolvedValue({ result: "ok" });

    await deleteImage("ecommerce/products/abc123");

    // destroy() sends a DELETE request to Cloudinary's API.
    // The publicId uniquely identifies the image to remove.
    expect(mockDestroy).toHaveBeenCalledWith("ecommerce/products/abc123");
  });

  it("should propagate Cloudinary errors", async () => {
    // If Cloudinary's API returns an error (e.g., image not found),
    // deleteImage should let it bubble up to the caller.
    mockDestroy.mockRejectedValue(new Error("Resource not found"));

    await expect(
      deleteImage("nonexistent/image")
    ).rejects.toThrow("Resource not found");
  });
});