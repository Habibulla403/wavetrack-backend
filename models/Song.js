import mongoose from "mongoose";

const dailyStreamSchema = new mongoose.Schema({
  date:    { type: String, required: true }, // "YYYY-MM-DD"
  streams: { type: Number, default: 0 },
}, { _id: false });

const songSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title:        { type: String, required: true },
  genre:        { type: String },
  duration:     { type: String },
  status:       { type: String, enum: ["draft", "pending", "live"], default: "pending" },
  streams:      { type: Number, default: 0 },
  earnings:     { type: Number, default: 0 },
  coverUrl:     { type: String },
  audioUrl:     { type: String },
  platformData: {
    spotify:      { type: Number, default: 0 },
    appleMusic:   { type: Number, default: 0 },
    youtubeMusic: { type: Number, default: 0 },
    deezer:       { type: Number, default: 0 },
  },
  dailyStreams:  { type: [dailyStreamSchema], default: [] },
}, { timestamps: true });

export default mongoose.model("Song", songSchema);
