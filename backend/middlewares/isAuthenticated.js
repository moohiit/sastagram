import jwt from 'jsonwebtoken';

export const isAuthenticated = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({
        message: "User is not authenticated.",
        success: false
      })
    }
    //Verify the jwt token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({
        message: "Invalid Token.",
        success: false
      })
    }
    req.id = decoded.userId;
    next();
  } catch (error) {
    // jwt.verify throws on invalid/expired tokens — that's a 401, not a 500
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session. Please log in again.",
    });
  }
}
// Optional auth: attaches req.id when a valid token cookie is present but
// never rejects — used by public read endpoints so guests can browse while
// logged-in users still get personalized responses (e.g. own bookmarks).
export const optionalAuth = (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.id = decoded.userId;
    }
  } catch {
    // invalid/expired token — treat as guest
  }
  next();
};
