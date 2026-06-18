import express from "express";
import Song from "../models/Song.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Plan upload limit check
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

// GET /api/songs — all songs for user
router.get("/", protect, async (req, res) => {
  try {
    const songs = await Song.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(songs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/songs — create song
router.post("/", protect, checkUploadLimit, async (req, res) => {
  try {
    const {
      title, genre, secondaryGenre, language, coverUrl, audioUrl,
      artistName, recordLabel, releaseDate, previouslyReleased,
      isCover, songwriters, isrc, explicit, isRadioEdit, instrumental,
      aiGenerated, featuredArtists, versionInfo, selectedPlatforms,
      spotifyArtistLink, appleMusicArtistLink, instagramLink, facebookLink,
      addons, trackPrice,
    } = req.body;

    if (!title) return res.status(400).json({ message: "Title required" });

    const song = await Song.create({
      user: req.user._id,
      title, genre, secondaryGenre, language, coverUrl, audioUrl,
      artistName, recordLabel, releaseDate, previouslyReleased,
      isCover, songwriters, isrc, explicit, isRadioEdit, instrumental,
      aiGenerated, featuredArtists, versionInfo, selectedPlatforms,
      spotifyArtistLink, appleMusicArtistLink, instagramLink, facebookLink,
      addons, trackPrice,
      status: "pending",
    });
    res.status(201).json(song);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/songs/:id — update song
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

// DELETE /api/songs/:id
router.delete("/:id", protect, async (req, res) => {
  try {
    const song = await Song.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!song) return res.status(404).json({ message: "Song not found" });
    res.json({ message: "Song deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/songs/stats — summary stats for dashboard
router.get("/stats", protect, async (req, res) => {
  try {
    const songs = await Song.find({ user: req.user._id });
    const totalStreams   = songs.reduce((a, s) => a + (s.streams || 0), 0);
    const totalEarnings  = songs.reduce((a, s) => a + (s.earnings || 0), 0);
    const liveSongs      = songs.filter(s => s.status === "live").length;
    const limits         = req.user.getPlanLimits();
    res.json({ total: songs.length, totalStreams, totalEarnings, liveSongs, plan: req.user.plan, limits });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/songs/analytics — real chart data
// Returns last 7 days & last 6 months from actual dailyStreams records
router.get("/analytics", protect, async (req, res) => {
  try {
    const songs = await Song.find({ user: req.user._id, status: "live" });

    // ── helper: date string "YYYY-MM-DD"
    const dateStr = (d) => d.toISOString().slice(0, 10);

    // ── last 7 days
    const weeklyMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      weeklyMap[dateStr(d)] = 0;
    }

    // ── last 6 months (by month label)
    const monthlyMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      monthlyMap[key] = 0;
    }

    // ── aggregate platform totals across all songs
    const platformTotals = { spotify: 0, appleMusic: 0, youtubeMusic: 0, deezer: 0 };
    let grandTotal = 0;

    for (const song of songs) {
      grandTotal += song.streams || 0;
      platformTotals.spotify      += song.platformData?.spotify      || 0;
      platformTotals.appleMusic   += song.platformData?.appleMusic   || 0;
      platformTotals.youtubeMusic += song.platformData?.youtubeMusic || 0;
      platformTotals.deezer       += song.platformData?.deezer       || 0;

      for (const ds of (song.dailyStreams || [])) {
        // weekly
        if (weeklyMap[ds.date] !== undefined) {
          weeklyMap[ds.date] += ds.streams;
        }
        // monthly
        const d   = new Date(ds.date);
        const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        if (monthlyMap[key] !== undefined) {
          monthlyMap[key] += ds.streams;
        }
      }
    }

    // ── platform percentage breakdown
    const pTotal = Object.values(platformTotals).reduce((a, b) => a + b, 0);
    let platformBreakdown;
    if (pTotal > 0) {
      platformBreakdown = [
        { name: "Spotify",       pct: Math.round((platformTotals.spotify / pTotal) * 100),      color: "#1DB954", bg: "bg-emerald-500" },
        { name: "Apple Music",   pct: Math.round((platformTotals.appleMusic / pTotal) * 100),   color: "#fc3c44", bg: "bg-rose-500"    },
        { name: "YouTube Music", pct: Math.round((platformTotals.youtubeMusic / pTotal) * 100), color: "#FF0000", bg: "bg-red-500"     },
        { name: "Deezer",        pct: Math.round((platformTotals.deezer / pTotal) * 100),        color: "#a238ff", bg: "bg-purple-500"  },
      ];
    } else {
      // No data yet — show default distribution percentages
      platformBreakdown = [
        { name: "Spotify",       pct: 58, color: "#1DB954", bg: "bg-emerald-500" },
        { name: "Apple Music",   pct: 22, color: "#fc3c44", bg: "bg-rose-500"    },
        { name: "YouTube Music", pct: 13, color: "#FF0000", bg: "bg-red-500"     },
        { name: "Deezer",        pct: 7,  color: "#a238ff", bg: "bg-purple-500"  },
      ];
    }

    // ── top songs
    const topSongs = [...songs]
      .sort((a, b) => (b.streams || 0) - (a.streams || 0))
      .slice(0, 5)
      .map(s => ({ _id: s._id, title: s.title, genre: s.genre, streams: s.streams || 0, earnings: s.earnings || 0 }));

    res.json({
      weekly:  Object.entries(weeklyMap).map(([date, streams]) => ({
        day: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
        date,
        streams,
      })),
      monthly: Object.entries(monthlyMap).map(([month, streams]) => ({ month, streams })),
      platformBreakdown,
      topSongs,
      totalStreams: grandTotal,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/songs/plan-limits
router.get("/plan-limits", protect, (req, res) => {
  res.json({ plan: req.user.plan, limits: req.user.getPlanLimits() });
});

export default router;
