import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/index.js';

// ─── Configure Cloudinary ────────────────────────────────
// This runs once when the module is first imported.
// v2 is the current version of the Cloudinary SDK.
// The "as cloudinary" import renames it for clarity.
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

/**
 * Upload an image buffer to Cloudinary.
 *
 * WHY a buffer instead of a file path?
 * multer gives us the file as a Buffer (raw bytes in memory).
 * We could write it to disk first, then upload from disk, then delete
 * the temp file — but that's 3 steps instead of 1. Streaming from
 * memory is faster and avoids temp file cleanup.
 *
 * @param buffer - Raw image bytes from multer (req.file.buffer)
 * @param folder - Cloudinary folder to organize images (e.g., "products")
 * @returns { publicId, url } — the Cloudinary ID and CDN URL
 */
export async function uploadImage(
  buffer: Buffer,
  folder = 'ecommerce/products'
): Promise<{ publicId: string; url: string }> {
  // upload_stream is Cloudinary's method for uploading from memory.
  // It returns a writable stream — we write the buffer to it.
  // Wrapped in a Promise because the SDK uses callbacks, not async/await.
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        // folder: organizes images in Cloudinary's media library.
        // All product images go under "ecommerce/products/".
        folder,

        // resource_type: "image" tells Cloudinary to process this as an image
        // (apply transformations, generate thumbnails, etc.)
        // Other types: "video", "raw" (PDFs, docs), "auto" (detect).
        resource_type: 'image',

        // transformation: applied during upload, stored permanently.
        // - width/height 1000: caps the max dimension. Product images don't need
        //   to be 4000x4000 — that wastes storage and bandwidth.
        // - crop "limit": only shrinks, never enlarges. A 500x500 image stays 500x500.
        // - quality "auto": Cloudinary picks the best quality/size tradeoff.
        //   A photo might get quality 80, a graphic might get 90.
        // - fetch_format "auto": serves WebP to Chrome, AVIF to Safari,
        //   JPEG to old browsers. The URL stays the same but the format adapts.
        transformation: [
          { width: 1000, height: 1000, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      // Callback — called when upload completes or fails.
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error('Upload failed'));
        }
        // result.public_id: Cloudinary's unique ID for this image.
        //   e.g., "ecommerce/products/abc123xyz"
        //   Used to delete the image later.
        // result.secure_url: The HTTPS CDN URL for the image.
        //   e.g., "https://res.cloudinary.com/dxxxxxx/image/upload/v123/ecommerce/products/abc123xyz.jpg"
        //   This is what the frontend uses in <img src="...">.
        resolve({
          publicId: result.public_id,
          url: result.secure_url,
        });
      }
    );

    // Write the buffer (raw bytes) to the upload stream.
    // .end() signals "I'm done sending data."
    stream.end(buffer);
  });
}

/**
 * Delete an image from Cloudinary by its public ID.
 *
 * Called when an admin removes a product image. Without this,
 * deleted product images would stay on Cloudinary forever,
 * eating into the free tier storage quota.
 *
 * @param publicId - The Cloudinary public ID (e.g., "ecommerce/products/abc123")
 */
export async function deleteImage(publicId: string): Promise<void> {
  // destroy() sends a DELETE request to Cloudinary's API.
  // The image is removed from storage and CDN cache.
  await cloudinary.uploader.destroy(publicId);
}
