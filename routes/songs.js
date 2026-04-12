import express from "express";
import Song from "../models/Song.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Plan upload limit check middleware
const checkUploadLimit = async (req, res, next) => {
  try {
    const limits = req.user.getPlanLimits();
    if (limits.maxSongs === Infinity) return next();
    const count = await Song.countDocuments({ user: req.user._id });
    if (count >= limits.maxSongs) {
      return res.status(403).json({
        message: `Your ${limits.label} plan allows up to ${limits.maxSongs} songs. Please upgrade to upload more.`,
        upgradeRequired: true,
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

router.get("/", protect, async (req, res) => {
  try {
    const songs = await Song.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(songs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", protect, checkUploadLimit, async (req, res) => {
  try {
    const { title, genre, coverUrl, audioUrl } = req.body;
    if (!title) return res.status(400).json({ message: "Title required" });
    const song = await Song.create({
      user: req.user._id,
      title, genre, coverUrl, audioUrl, status: "pending",
    });
    res.status(201).json(song);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", protect, async (req, res) => {
  try {
    const song = await Song.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body, { new: true }
    );
    if (!song) return res.status(404).json({ message: "Song not found" });
    res.json(song);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const song = await Song.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!song) return res.status(404).json({ message: "Song not found" });
    res.json({ message: "Song deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/stats", protect, async (req, res) => {
  try {
    const songs = await Song.find({ user: req.user._id });
    const totalStreams  = songs.reduce((a, s) => a + s.streams, 0);
    const totalEarnings = songs.reduce((a, s) => a + s.earnings, 0);
    const liveSongs     = songs.filter(s => s.status === "live").length;
    const limits        = req.user.getPlanLimits();
    res.json({ total: songs.length, totalStreams, totalEarnings, liveSongs, plan: req.user.plan, limits });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/songs/plan-limits
router.get("/plan-limits", protect, (req, res) => {
  res.json({ plan: req.user.plan, limits: req.user.getPlanLimits() });
});

export default router;
