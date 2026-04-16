import express from "express";
import { protect, requireRole } from "../middleware/auth.js";
import User from "../models/User.js";
import Song from "../models/Song.js";

const router = express.Router();

// All admin routes require auth + mod or admin role
router.use(protect);
router.use(requireRole("mod", "admin"));

// ── GET /api/admin/stats ───────────────────────────────────────────
// Overview stats for admin dashboard
router.get("/stats", async (req, res) => {
  try {
    const [totalUsers, totalSongs, premiumUsers, pendingPayouts] = await Promise.all([
      User.countDocuments({ role: "user" }),
      Song.countDocuments(),
      User.countDocuments({ plan: { $ne: "free" }, role: "user" }),
      User.countDocuments({ "payoutRequests.status": "pending" }),
    ]);

    const songs   = await Song.find();
    const revenue = songs.reduce((a, s) => a + (s.earnings || 0), 0);

    res.json({ totalUsers, totalSongs, premiumUsers, pendingPayouts, totalRevenue: revenue });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/admin/users ───────────────────────────────────────────
// List all users with their songs count and earnings
router.get("/users", async (req, res) => {
  try {
    const { search, plan, page = 1, limit = 20 } = req.query;
    const query = { role: "user" };
    if (plan)   query.plan = plan;
    if (search) query.$or = [
      { name:  { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await User.countDocuments(query);

    // Attach song count + earnings per user
    const enriched = await Promise.all(users.map(async (u) => {
      const songs    = await Song.find({ user: u._id });
      const earnings = songs.reduce((a, s) => a + (s.earnings || 0), 0);
      const pending  = (u.payoutRequests || []).find(r => r.status === "pending");
      return {
        _id: u._id, name: u.name, email: u.email, plan: u.plan,
        createdAt: u.createdAt, avatarUrl: u.avatarUrl,
        songCount: songs.length, totalEarnings: earnings,
        hasPendingPayout: !!pending,
        pendingAmount: pending?.amount || 0,
        payoutInfo: u.payoutInfo || null,
      };
    }));

    res.json({ users: enriched, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/admin/users/:id ───────────────────────────────────────
// Get single user detail
router.get("/users/:id", async (req, res) => {
  try {
    const user  = await User.findById(req.params.id).select("-password");
    if (!user)  return res.status(404).json({ message: "User not found" });
    const songs = await Song.find({ user: user._id }).sort({ createdAt: -1 });
    res.json({ user, songs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/admin/users/:id/plan ───────────────────────────────
// Change a user's plan manually (admin only)
router.patch("/users/:id/plan", requireRole("admin"), async (req, res) => {
  try {
    const { plan } = req.body;
    const valid = ["free","musician","musician_plus","ultimate"];
    if (!valid.includes(plan)) return res.status(400).json({ message: "Invalid plan" });
    const user = await User.findByIdAndUpdate(req.params.id, { plan }, { new: true }).select("-password");
    res.json({ message: `Plan updated to ${plan}`, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/admin/songs ───────────────────────────────────────────
// List all songs with filter by status
router.get("/songs", async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) query.title = { $regex: search, $options: "i" };

    const songs = await Song.find(query)
      .populate("user", "name email plan")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Song.countDocuments(query);
    res.json({ songs, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/admin/songs/:id/status ─────────────────────────────
// Approve / reject a song
router.patch("/songs/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending","live","draft"].includes(status))
      return res.status(400).json({ message: "Invalid status" });
    const song = await Song.findByIdAndUpdate(req.params.id, { status }, { new: true })
      .populate("user", "name email");
    res.json({ message: `Song marked as ${status}`, song });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/admin/payouts ─────────────────────────────────────────
// All pending payout requests
router.get("/payouts", async (req, res) => {
  try {
    const users = await User.find({ "payoutRequests.0": { $exists: true } }).select("-password");
    const result = [];
    for (const u of users) {
      for (const req of (u.payoutRequests || [])) {
        result.push({
          userId:      u._id,
          userName:    u.name,
          userEmail:   u.email,
          plan:        u.plan,
          payoutInfo:  u.payoutInfo,
          requestId:   req._id,
          amount:      req.amount,
          method:      req.method,
          status:      req.status,
          createdAt:   req.createdAt,
          note:        req.note,
        });
      }
    }
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/admin/payouts/:userId/:requestId ────────────────────
// Mark payout as paid or rejected
router.patch("/payouts/:userId/:requestId", async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!["paid","rejected","pending"].includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const pr = user.payoutRequests.id(req.params.requestId);
    if (!pr) return res.status(404).json({ message: "Payout request not found" });

    pr.status = status;
    if (note) pr.note = note;
    await user.save();

    res.json({ message: `Payout marked as ${status}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/admin/messages ────────────────────────────────────────
// All support messages from users
router.get("/messages", async (req, res) => {
  try {
    const users = await User.find({ "supportMessages.0": { $exists: true } }).select("-password");
    const msgs  = [];
    for (const u of users) {
      for (const m of (u.supportMessages || [])) {
        msgs.push({
          userId:    u._id, userName: u.name, userEmail: u.email,
          messageId: m._id, subject: m.subject, body: m.body,
          status:    m.status, reply: m.reply,
          createdAt: m.createdAt,
        });
      }
    }
    msgs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/admin/messages/:userId/:messageId/reply ─────────────
// Reply to a user support message
router.post("/messages/:userId/:messageId/reply", async (req, res) => {
  try {
    const { reply } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const msg = user.supportMessages.id(req.params.messageId);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    msg.reply  = reply;
    msg.status = "replied";
    await user.save();

    res.json({ message: "Reply sent" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
