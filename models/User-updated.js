import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name:                 { type: String, required: true },
  email:                { type: String, required: true, unique: true },
  password:             { type: String, required: true },
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
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

export default mongoose.model("User", userSchema);
