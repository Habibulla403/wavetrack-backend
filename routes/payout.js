import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import Song from "../models/Song.js";

const router = express.Router();

// ── GET /api/payout/status ─────────────────────────────────────────
// Returns user's total earnings, payout info, and eligibility
router.get("/status", protect, async (req, res) => {
  try {
    const user  = await User.findById(req.user._id).select("plan payoutInfo payoutRequests");
    const songs = await Song.find({ user: req.user._id });

    const totalEarnings  = songs.reduce((a, s) => a + (s.earnings || 0), 0);
    const paidOut        = (user.payoutRequests || [])
      .filter(r => r.status === "paid")
      .reduce((a, r) => a + r.amount, 0);
    const pendingPayout  = (user.payoutRequests || [])
      .filter(r => r.status === "pending")
      .reduce((a, r) => a + r.amount, 0);
    const available      = Math.max(0, totalEarnings - paidOut - pendingPayout);

    const isPremium = user.plan && user.plan !== "free";

    res.json({
      totalEarnings,
      paidOut,
      pendingPayout,
      available,
      isPremium,
      plan: user.plan || "free",
      payoutInfo: user.payoutInfo || null,
      payoutRequests: (user.payoutRequests || []).slice(-10).reverse(), // last 10
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/payout/info ──────────────────────────────────────────
// Save payout info (PayPal email or bank)
router.post("/info", protect, async (req, res) => {
  try {
    const { method, paypalEmail, bankName, accountNumber, accountName } = req.body;

    if (!method) return res.status(400).json({ message: "Payout method required" });

    await User.findByIdAndUpdate(req.user._id, {
      payoutInfo: { method, paypalEmail, bankName, accountNumber, accountName },
    });

    res.json({ message: "Payout info saved" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/payout/request ───────────────────────────────────────
// Request a payout — only allowed for premium users
router.post("/request", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // ── PLAN CHECK ── Free users cannot withdraw ──────────────────
    if (!user.plan || user.plan === "free") {
      return res.status(403).json({
        message: "Payout requires a Premium plan. Please upgrade to Musician, Musician Plus, or Ultimate.",
        requiresUpgrade: true,
      });
    }

    // Check payout info is set
    if (!user.payoutInfo?.method) {
      return res.status(400).json({ message: "Please set your payout info first." });
    }

    // Calculate available
    const songs         = await Song.find({ user: req.user._id });
    const totalEarnings = songs.reduce((a, s) => a + (s.earnings || 0), 0);
    const paidOut       = (user.payoutRequests || [])
      .filter(r => r.status === "paid")
      .reduce((a, r) => a + r.amount, 0);
    const pendingPayout = (user.payoutRequests || [])
      .filter(r => r.status === "pending")
      .reduce((a, r) => a + r.amount, 0);
    const available     = Math.max(0, totalEarnings - paidOut - pendingPayout);

    // Minimum payout $1
    if (available < 1) {
      return res.status(400).json({ message: `Minimum payout is $1.00. You have $${available.toFixed(2)} available.` });
    }

    // Check no other pending request
    const hasPending = (user.payoutRequests || []).some(r => r.status === "pending");
    if (hasPending) {
      return res.status(400).json({ message: "You already have a pending payout request." });
    }

    // Create payout request
    const newRequest = {
      amount:    available,
      method:    user.payoutInfo.method,
      status:    "pending",
      createdAt: new Date(),
    };

    await User.findByIdAndUpdate(req.user._id, {
      $push: { payoutRequests: newRequest },
    });

    res.json({
      message: `Payout request of $${available.toFixed(2)} submitted. We'll process it within 3–5 business days.`,
      amount: available,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
