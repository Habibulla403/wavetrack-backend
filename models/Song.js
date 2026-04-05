import mongoose from "mongoose";

const songSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  genre: { type: String },
  duration: { type: String },
  status: { type: String, enum: ["draft", "pending", "live"], default: "pending" },
  streams: { type: Number, default: 0 },
  earnings: { type: Number, default: 0 },
  coverUrl: { type: String },
  audioUrl: { type: String },
}, { timestamps: true });

export default mongoose.model("Song", songSchema);
