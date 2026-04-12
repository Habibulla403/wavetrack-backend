import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import authRoutes from "./routes/auth.js";
import songRoutes from "./routes/songs.js";
import uploadRoutes from "./routes/upload.js";
import paymentRoutes from "./routes/payment.js";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();

// Stripe webhook needs raw body — MUST be before express.json()
app.use("/api/payment/webhook", express.raw({ type: "application/json" }));

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

app.use("/api/auth",    authRoutes);
app.use("/api/songs",   songRoutes);
app.use("/api/upload",  uploadRoutes);
app.use("/api/payment", paymentRoutes);

app.get("/", (req, res) => res.json({ message: "WaveTrack API running" }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
