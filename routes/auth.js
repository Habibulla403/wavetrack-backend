import express from "express";
import jwt from "jsonwebtoken";
import User, { PRIVILEGED } from "../models/User.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required" });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already exists" });

    const role = PRIVILEGED[email.toLowerCase()] || "user";
    const user = await User.create({ name, email, password, role });

    res.status(201).json({
      _id: user._id, name: user.name, email: user.email,
      plan: user.plan, role: user.role, token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ message: "Invalid email or password" });

    // Re-sync role in case it changed
    const correctRole = PRIVILEGED[email.toLowerCase()] || "user";
    if (user.role !== correctRole) {
      user.role = correctRole;
      await user.save();
    }

    res.json({
      _id: user._id, name: user.name, email: user.email,
      plan: user.plan, role: user.role,
      bio: user.bio, location: user.location,
      genre: user.genre, website: user.website,
      socialLinks: user.socialLinks, avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me
router.get("/me", protect, async (req, res) => {
  const u = req.user;
  res.json({
    _id: u._id, name: u.name, email: u.email, plan: u.plan, role: u.role,
    bio: u.bio, location: u.location, genre: u.genre,
    website: u.website, socialLinks: u.socialLinks,
    avatarUrl: u.avatarUrl, createdAt: u.createdAt,
  });
});

// PUT /api/auth/profile
router.put("/profile", protect, async (req, res) => {
  try {
    const { name, bio, location, genre, website, socialLinks, avatarUrl, coverUrl } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name)                     user.name        = name;
    if (bio        !== undefined) user.bio         = bio;
    if (location   !== undefined) user.location    = location;
    if (genre      !== undefined) user.genre       = genre;
    if (website    !== undefined) user.website     = website;
    if (socialLinks)              user.socialLinks = socialLinks;
    if (avatarUrl)                user.avatarUrl   = avatarUrl;
    if (coverUrl   !== undefined) user.coverUrl    = coverUrl;

    await user.save();
    res.json({
      _id: user._id, name: user.name, email: user.email, plan: user.plan, role: user.role,
      bio: user.bio, location: user.location, genre: user.genre,
      website: user.website, socialLinks: user.socialLinks,
      avatarUrl: user.avatarUrl, coverUrl: user.coverUrl, createdAt: user.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/google
router.post("/google", async (req, res) => {
  try {
    const { googleId, email, name, avatar } = req.body;
    let user = await User.findOne({ email });
    if (!user) {
      const role = PRIVILEGED[email.toLowerCase()] || "user";
      user = await User.create({ name, email, googleId, avatar, role });
    }
    res.json({
      _id: user._id, name: user.name, email: user.email,
      plan: user.plan, role: user.role, avatarUrl: user.avatarUrl,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
