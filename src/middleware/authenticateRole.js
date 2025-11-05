
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

function extractAccessToken(req) {
  const auth = req.headers.authorization || req.header("Authorization");
  if (auth && auth.startsWith("Bearer ")) {
    return auth.split(" ")[1];
  }
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  if (req.query && req.query.access_token) {
    return req.query.access_token;
  }
  return null;
}

const authenticateJWT = async (req, res, next) => {

  const token = extractAccessToken(req);
 
  if (!token) {
    return res.status(401).json({ success: false, message: "Access denied: missing token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await User.findById(decoded.id).lean();
    if (!user) return res.status(401).json({ success: false, message: "Invalid token: user not found" });

    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: "Account is blocked" });
    }

    req.user = { id: user._id, role: user.role, email: user.email };
    req.userId = user._id;
    next();
  } catch (err) {
    console.error("❌ Token verification error:", err);
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};


module.exports = authenticateJWT;
