import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Privileged accounts — auto-assigned on register/login
const PRIVILEGED = {
  "admin1232@gmail.com":  "admin",
  "mod1212@gmail.com":    "mod",
  "mod1234@gmail.com":    "mod",
  "mod1257@gmail.com":    "mod",
  "mod18907@gmail.com":   "mod",
};

const userSchema = new mongoose.Schema({
  name:                 { type: String, required: true },
  email:                { type: String, required: true, unique: true },
  password:             { type: String },
  googleId:             { type: String },
  avatar:               { type: String },
  role:                 { type: String, enum: ["user", "mod", "admin"], default: "user" },
  plan:                 { type: String, enum: ["free","musician","musician_plus","ultimate"], default: "free" },
  stripeCustomerId:     { type: String, default: null },
  stripeSubscriptionId: { type: String, default: null },
  bio:                  { type: String, default: "" },
  location:             { type: String, default: "" },
  genre:                { type: String, default: "" },
  website:              { type: String, default: "" },
  socialLinks:          { type: Object, default: {} },
  avatarUrl:            { type: String, default: "" },
  coverUrl:             { type: String, default: "" },
  payoutInfo: {
    method:        { type: String, enum: ["paypal", "bank"], default: null },
    paypalEmail:   { type: String, default: "" },
    bankName:      { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    accountName:   { type: String, default: "" },
  },
  payoutRequests: [{
    amount:    { type: Number },
    method:    { type: String },
    status:    { type: String, enum: ["pending", "paid", "rejected"], default: "pending" },
    createdAt: { type: Date, default: Date.now },
    note:      { type: String, default: "" },
  }],
  supportMessages: [{
    subject:   { type: String },
    body:      { type: String },
    status:    { type: String, enum: ["open", "replied", "closed"], default: "open" },
    reply:     { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  }],
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

export { PRIVILEGED };
export default mongoose.model("User", userSchema);
