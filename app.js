import express from "express";
import dotenv from "dotenv";
dotenv.config({ path: "./config/config.env" });
const startupKey = (process.env.JWT_SECRET_KEY || "").trim().replace(/^["']|["']$/g, '');
console.log(`🚀 Server starting. JWT Key Fingerprint: ${startupKey.substring(0, 2)}...${startupKey.substring(startupKey.length - 2)} (Length: ${startupKey.length})`);
import cookieParser from "cookie-parser";
import morgan from "morgan";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { connectDB } from "./database/db.js";
import { errorMiddleware } from "./middlewares/errorMiddlewares.js";
import { apiRequestLogger } from "./middlewares/apiLogger.js";
import authRouter from "./routes/authRouter.js"
import gymShoodRouter from "./routes/1_gymShoodDbRoute.js"
import adminRouter from "./routes/adminRoutes.js"
import paymentRouter from "./routes/payment.routes.js"
import userDataRouter from "./routes/userDataRoutes.js";
import adminPlanRouter from "./routes/adminPlanRoutes.js";
import partnerSubRouter from "./routes/gymSubscriptionRoutes.js";
import menuRouter from "./routes/menuRoutes.js";
import tenantRouter from "./routes/tenantRoutes.js";
import companyRouter from "./routes/companyRoutes.js";
import clientHierarchyRoutes from "./routes/clientHierarchyRoutes.js";
import globalMenuRoutes from "./routes/globalMenuRoutes.js";
import memberRouter from "./routes/memberRoutes.js";
import { upload } from "./middlewares/multer.js";
import { isAuthenticated } from "./middlewares/authMiddleware.js";

export const app = express();

// Removed redundant dotenv config

app.use(cors({
  origin: [
    'http://147.93.30.41:5001',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'https://gyms-hood.vercel.app',
    'http://localhost:3000',
    'http://localhost:3000/googleAuth',
    'http://localhost:5173',
    'http://192.168.1.137:8000',
    'http://192.168.1.137:6000',
    'http://192.168.1.137:5000',
    'http://192.168.1.137:4000',
    'http://192.168.1.137:8081', // Native Expo dev port
    'https://gymhoodbackend.onrender.com',
    'https://gymhood-partner-app.onrender.com',
    'https://gymshodd-partner-app.netlify.app',
    'https://www.gymshood.com'
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Professional API Request/Response, Query & Error Logger
app.use(apiRequestLogger);

// Serve uploads directly from the main backend
app.use("/files", (req, res, next) => {
  // Normalize URLs: Remove any trailing underscores or malformed extensions like .jp._
  if (req.url.includes(".jp._")) {
    req.url = req.url.replace(".jp._", ".jpg");
  } else if (req.url.endsWith("_")) {
    req.url = req.url.slice(0, -1);
  }
  next();
});

const uploadsPath = path.join(process.cwd(), "uploads");
app.use("/files", express.static(uploadsPath, {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

const assetsPath = path.join(process.cwd(), "assets");
app.use("/assets", express.static(assetsPath, {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

// Legacy Route Mounts (100% Backward Compatible)
app.use("/auth", authRouter);
app.use("/gymdb", gymShoodRouter);
app.use("/admin", adminRouter);
app.use("/admin-plans", adminPlanRouter);
app.use("/partner-subscription", partnerSubRouter);
app.use("/payment", paymentRouter);
app.use("/user-data", userDataRouter);

// Versioned SaaS Multi-Tenant Endpoints (/api/v1)
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/tenants", tenantRouter);
app.use("/api/v1/branches", tenantRouter);
app.use("/api/v1/menus", menuRouter);
app.use("/api/v1/company", companyRouter);
app.use("/company", companyRouter);
app.use("/api/v1/client-company", clientHierarchyRoutes);
app.use("/client-company", clientHierarchyRoutes);
app.use("/api/v1/global-menus", globalMenuRoutes);
app.use("/global-menus", globalMenuRoutes);
app.use("/api/v1/members", memberRouter);
app.use("/members", memberRouter);

app.get("/ping", (req, res) => {
  console.log("Ping hit!");
  const user = req.query.name || "Guest";
  res.json({ message: `Pong, ${user}` });
});

// Real-time File Upload Route (integrated from fileServer)
app.post("/upload", upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  // const fileUrl = `${req.protocol}://${req.get('host')}/files/${req.file.filename}`;
  const fileUrl = `/files/${req.file.filename}`;


  res.status(201).json({
    success: true,
    message: 'File uploaded successfully',
    filename: req.file.filename,
    url: fileUrl
  });
});


connectDB().catch(err => { console.error('Database connection failed:', err); process.exit(1); });


app.use(errorMiddleware);

// Start server if this file is run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
