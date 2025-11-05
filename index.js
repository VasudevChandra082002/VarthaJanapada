const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet"); // ✅ for security headers
const connectDB = require("./src/config/mongoConnect");

const newsRoutes = require("./src/routes/newsRoutes");
const categoryRoutes = require("./src/routes/categoryRoutes");
const tagRoutes = require("./src/routes/tagRoutes");
const userRoutes = require("./src/routes/userRoutes");
const authRoutes = require("./src/routes/authRoutes");
const bannerRoutes = require("./src/routes/bannerRoutes");
const commentRoutes = require("./src/routes/commentRoutes");
const videoRoutes = require("./src/routes/videoRoutes");
const magazine = require("./src/routes/magazineRoutes");
const longVideo = require("./src/routes/longVideoRoutes");
const sessionRoutes = require("./src/routes/sessionRoutes");
const visitorRoutes = require("./src/routes/visitorRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");
const magazineRoutes2 = require("./src/routes/magazineRoutes2");
const wishlistRoutes = require("./src/routes/wishlistRoutes");
const announcement = require("./src/routes/announcementRoutes");
const readingHistoryRoutes = require("./src/routes/readingHistoryRoutes");
const recommendationRoutes = require("./src/routes/recommendationRoutes");
const analyticsRoutes = require("./src/routes/analyticsRoutes");
const searchContent = require("./src/routes/searchRoutes");
const photoRoutes = require("./src/routes/photosRoutes");
const staticRoutes = require("./src/routes/staticpageRoutes");
const latestNotificationRoutes = require("./src/routes/latestNotificationRoutes");
const playlistRoutes = require("./src/routes/playlistRoutes");

const path = require("path");
dotenv.config({ path: path.resolve(__dirname, ".env") });

const app = express();
const port = process.env.PORT || 3000;



const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://frontend-digi9.vercel.app",
  "https://dipr.vercel.app",
  "https://dipradmin.gully2global.in",
  "https://diprwebapp.gully2global.in",
  "https://vartha-janapada.vercel.app",
  "http://varthe.karnataka.gov.in",
  "https://varthe.karnataka.gov.in",
];

app.use(
  cors({
    origin: function (origin, callback) {
      console.log(origin);
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
  })
);

// ✅ Helmet with allowed origins
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'", ...allowedOrigins],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true,
  })
);



app.use((req, res, next) => {
  // Set proper Content-Type with charset for all responses
  if (res.getHeader('Content-Type') && !res.getHeader('Content-Type').includes('charset')) {
    const currentType = res.getHeader('Content-Type');
    if (currentType.includes('text/html') || currentType.includes('text/plain')) {
      res.setHeader('Content-Type', `${currentType}; charset=UTF-8`);
    }
  }
 
  // Additional security headers not covered by Helmet
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), ambient-light-sensor=(), autoplay=(), encrypted-media=(), fullscreen=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), web-share=(), xr-spatial-tracking=()');
 
  // Ensure X-XSS-Protection is set (Helmet sets this but we ensure it's correct)
  res.setHeader('X-XSS-Protection', '1; mode=block');
 
  next();
});

app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    if (typeof data === 'object' && !res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json; charset=UTF-8');
    } else if (typeof data === 'string' && !res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    }
    return originalSend.call(this, data);
  };
  next();
});


connectDB();
app.use(express.json());

app.use("/api/news", newsRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/banner", bannerRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/video", videoRoutes);
app.use("/api/magazine", magazine);
app.use("/api/longVideo", longVideo);
app.use("/sessions", sessionRoutes);
app.use("/visitors", visitorRoutes);
app.use("/notifications", notificationRoutes);
app.use("/api/magazine2", magazineRoutes2);
app.use("/wishlist", wishlistRoutes);
app.use("/announcement", announcement);
app.use("/api/reading-history", readingHistoryRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/search", searchContent);
app.use("/api/photos", photoRoutes);
app.use("/api/static", staticRoutes);
app.use("/api/latestnotifications", latestNotificationRoutes);
app.use("/api/playlist", playlistRoutes);

app.get("/", (req, res) => {
  res.send("Server running securely!");
});

app.listen(port, () => {
  console.log(` Secure server running on port ${port}`);
});

