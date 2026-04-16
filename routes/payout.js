import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import Song from "../models/Song.js";

const router = express.Router();

const VAT_RATE = (plan) => plan === "free" ? 0.30 : 0.20; // 30% free, 20% premium
const MIN_PAYOUT = 10; // $10 minimum

// ── GET /api/payout/status ─────────────────────────────────────────
router.get("/status", protect, async (req, res) => {
  try {
    const user  = await User.findById(req.user._id).select("plan payoutInfo payoutRequests supportMessages");
    const songs = await Song.find({ user: req.user._id });

    const totalEarnings = songs.reduce((a, s) => a + (s.earnings || 0), 0);
    const vat           = VAT_RATE(user.plan);
    const vatAmount     = totalEarnings * vat;
    const afterVat      = totalEarnings - vatAmount;

    const paidOut       = (user.payoutRequests || [])
      .filter(r => r.status === "paid")
      .reduce((a, r) => a + r.amount, 0);
    const pendingPayout = (user.payoutRequests || [])
      .filter(r => r.status === "pending")
      .reduce((a, r) => a + r.amount, 0);
    const available     = Math.max(0, afterVat - paidOut - pendingPayout);

    const isPremium = user.plan && user.plan !== "free";

    res.json({
      totalEarnings,
      vatRate: vat,
      vatAmount,
      afterVat,
      paidOut,
      pendingPayout,
      available,
      isPremium,
      plan:           user.plan || "free",
      payoutInfo:     user.payoutInfo || null,
      payoutRequests: (user.payoutRequests || []).slice(-10).reverse(),
      supportMessages: (user.supportMessages || []).slice(-5).reverse(),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/payout/info ──────────────────────────────────────────
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
router.post("/request", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Free users CAN request — but VAT is 30%, minimum $10 after VAT
    if (!user.payoutInfo?.method) {
      return res.status(400).json({ message: "Please set your payout info first." });
    }

    // Minimum $10 check
    const songs         = await Song.find({ user: req.user._id });
    const totalEarnings = songs.reduce((a, s) => a + (s.earnings || 0), 0);
    const vat           = VAT_RATE(user.plan);
    const afterVat      = totalEarnings * (1 - vat);

    const paidOut       = (user.payoutRequests || [])
      .filter(r => r.status === "paid")
      .reduce((a, r) => a + r.amount, 0);
    const pendingPayout = (user.payoutRequests || [])
      .filter(r => r.status === "pending")
      .reduce((a, r) => a + r.amount, 0);
    const available     = Math.max(0, afterVat - paidOut - pendingPayout);

    if (available < MIN_PAYOUT) {
      return res.status(400).json({
        message: `Minimum withdrawal is $${MIN_PAYOUT}. After ${Math.round(vat * 100)}% VAT, you have $${available.toFixed(2)} available.`,
      });
    }

    const hasPending = (user.payoutRequests || []).some(r => r.status === "pending");
    if (hasPending) {
      return res.status(400).json({ message: "You already have a pending payout request." });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $push: {
        payoutRequests: {
          amount: available, method: user.payoutInfo.method,
          status: "pending", createdAt: new Date(),
        },
      },
    });

    res.json({
      message: `Payout request of $${available.toFixed(2)} submitted (after ${Math.round(vat * 100)}% VAT). Processed within 3–5 business days.`,
      amount: available,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/payout/support ───────────────────────────────────────
// User sends a support message to admin/mod
router.post("/support", protect, async (req, res) => {
  try {
    const { subject, body } = req.body;
    if (!subject || !body) return res.status(400).json({ message: "Subject and message required" });

    await User.findByIdAndUpdate(req.user._id, {
      $push: { supportMessages: { subject, body, status: "open", createdAt: new Date() } },
    });

    res.json({ message: "Message sent to support team. We'll reply within 24 hours." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
