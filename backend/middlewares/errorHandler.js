import multer from "multer";

// Global error handler — keeps internal details out of responses while the
// full error is still logged server-side.
const errorHandler = (err, req, res, next) => {
  console.error(err);

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "Image must be 5 MB or smaller" : err.message;
    return res.status(400).json({ success: false, message });
  }

  if (err.message && err.message.startsWith("Only JPEG")) {
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err.code === 11000) {
    // Mongo duplicate key
    const field = Object.keys(err.keyPattern || {})[0] || "value";
    return res.status(409).json({ success: false, message: `That ${field} is already taken` });
  }

  return res.status(500).json({ success: false, message: "Internal server error" });
};

export default errorHandler;
