import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateToken } from '../middleware/auth';
import {
  VEHICLES_UPLOADS_DIR,
  generateVehicleFilename,
  deleteUploadedFile,
  logUploadDebugInfo
} from '../utils/storage';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, VEHICLES_UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const vehicleId = (req.body && req.body.vehicleId) || (req.params && (req.params as any).id) || '';
    const filename = generateVehicleFilename(vehicleId, file.originalname);
    cb(null, filename);
  }
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  const validExts = ['.jpg', '.jpeg', '.png', '.webp'];

  if (allowedMimeTypes.includes(file.mimetype.toLowerCase()) || validExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Please upload JPG, PNG, JPEG, or WEBP image.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB limit
});

// Middleware to catch Multer errors specifically
export const handleUpload = (req: Request, res: Response, next: NextFunction) => {
  const singleUpload = upload.single('image');
  singleUpload(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'Image must be smaller than 5 MB.' });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    } else if (err) {
      res.status(400).json({ error: err.message || 'Please upload JPG, PNG, JPEG, or WEBP image.' });
      return;
    }
    next();
  });
};

// Flexible middleware for vehicle registration & edit routes (supports JSON or multipart with image/photo)
export const handleOptionalVehicleUpload = (req: Request, res: Response, next: NextFunction) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    const multiUpload = upload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'profile_image', maxCount: 1 },
      { name: 'profileImage', maxCount: 1 },
      { name: 'photo', maxCount: 1 },
      { name: 'file', maxCount: 1 }
    ]);

    multiUpload(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: 'Image must be smaller than 5 MB.' });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      } else if (err) {
        res.status(400).json({ error: err.message || 'Please upload JPG, PNG, JPEG, or WEBP image.' });
        return;
      }

      // Map any uploaded field to req.file for seamless access
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      if (files) {
        req.file = files['image']?.[0] || 
                   files['profile_image']?.[0] || 
                   files['profileImage']?.[0] || 
                   files['photo']?.[0] || 
                   files['file']?.[0];
      }

      next();
    });
  } else {
    next();
  }
};

// POST /api/uploads/image - Single image upload
router.post('/image', authenticateToken, handleUpload, (req: Request, res: Response): void => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image file uploaded' });
      return;
    }

    const fileUrl = `/uploads/vehicles/${req.file.filename}`;

    logUploadDebugInfo({
      vehicleId: req.body.vehicleId,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      sizeBytes: req.file.size,
      storedFilename: req.file.filename,
      storedPath: req.file.path,
      publicUrl: fileUrl
    });

    res.status(201).json({
      message: 'Image uploaded successfully',
      url: fileUrl,
      imageUrl: fileUrl,
      profileImageUrl: fileUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Image upload failed' });
  }
});

// DELETE /api/uploads/file - Delete an uploaded file safely
router.delete('/file', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { url, filename } = req.body;
    const target = url || (filename ? `/uploads/vehicles/${filename}` : null);

    if (!target) {
      res.status(400).json({ error: 'Filename or URL required' });
      return;
    }

    const deleted = deleteUploadedFile(target);
    res.json({ message: deleted ? 'Image deleted successfully' : 'File already cleaned up or not found' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete image' });
  }
});

export default router;
