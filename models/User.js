import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name:                 { type: String, required: true },
  email:                { type: String, required: true, unique: true },
  password:             { type: String },
  googleId:             { type: String },
  avatar:               { type: String },
  plan:                 { type: String, enum: ["free","musician","musician_plus","ultimate"], default: "free" },
  stripeCustomerId:     { type: String, default: null },
  stripeSubscriptionId: { type: String, default: null },
  bio:                  { type: String, default: "" },
  location:             { type: String, default: "" },
  genre:                { type: String, default: "" },
  website:              { type: String, default: "" },
  socialLinks:          { type: Object, default: {} },
  avatarUrl:            { type: String, default: "" },
}, { timestamps: true });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Plan limits helper
userSchema.methods.getPlanLimits = function () {
  const limits = {
    free:          { maxSongs: 3,         platforms: 4,   analytics: "basic",    label: "Free" },
    musician:      { maxSongs: Infinity,   platforms: 150, analytics: "basic",    label: "Musician" },
    musician_plus: { maxSongs: Infinity,   platforms: 150, analytics: "advanced", label: "Musician Plus" },
    ultimate:      { maxSongs: Infinity,   platforms: 150, analytics: "advanced", label: "Ultimate" },
  };
  return limits[this.plan] || limits.free;
};

export default mongoose.model("User", userSchema);
