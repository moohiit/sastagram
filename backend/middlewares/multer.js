import multer from "multer";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

// The 50MB ceiling covers videos; image-only endpoints (stories, avatars,
// AI captions) and the image branch of addNewPost enforce their own tighter
// checks on top.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB (video ceiling)
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if ([...IMAGE_TYPES, ...VIDEO_TYPES].includes(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPEG/PNG/WEBP/GIF images or MP4/MOV/WEBM videos are allowed"));
  },
});

export const isImageFile = (file) => IMAGE_TYPES.includes(file?.mimetype);
export const isVideoFile = (file) => VIDEO_TYPES.includes(file?.mimetype);

export default upload;
