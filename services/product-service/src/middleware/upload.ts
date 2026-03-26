import multer from 'multer';

// Keep uploaded files in memory as a Buffer — we stream directly to
// Cloudinary without writing to disk.
const storage = multer.memoryStorage();

// Only accept image files (image/jpeg, image/png, image/webp, etc.)
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

// 5MB max file size — protects RAM since we use memoryStorage
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
