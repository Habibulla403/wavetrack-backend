import express from "express";
import { v2 as cloudinary } from "cloudinary";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/", protect, async (req, res) => {
  try {
    const { file, type } = req.body;

    if (!file) return res.status(400).json({ message: "No file provided" });

    const resourceType = type === "audio" ? "video" : "image";

    const result = await cloudinary.uploader.upload(file, {
      resource_type: resourceType,
      folder: type === "audio" ? "wavetrack/songs" : "wavetrack/covers",
    });

    res.json({ url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
