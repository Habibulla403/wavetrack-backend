import mongoose from "mongoose";

const dailyStreamSchema = new mongoose.Schema({
  date:    { type: String, required: true }, // "YYYY-MM-DD"
  streams: { type: Number, default: 0 },
}, { _id: false });

const songwriterSchema = new mongoose.Schema({
  firstName: { type: String, default: "" },
  middleName:{ type: String, default: "" },
  lastName:  { type: String, default: "" },
}, { _id: false });

const songSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // ── Basic info ──
  title:        { type: String, required: true },
  artistName:   { type: String, default: "" },
  genre:        { type: String },
  secondaryGenre: { type: String, default: "" },
  language:     { type: String, default: "English" },
  duration:     { type: String },
  status:       { type: String, enum: ["draft", "pending", "live"], default: "pending" },

  // ── Release details ──
  recordLabel:  { type: String, default: "" },
  releaseDate:  { type: Date },
  previouslyReleased: { type: Boolean, default: false },

  // ── Track metadata ──
  isCover:      { type: Boolean, default: false },
  songwriters:  { type: [songwriterSchema], default: [] },
  isrc:         { type: String, default: "" },
  explicit:     { type: Boolean, default: false },
  isRadioEdit:  { type: Boolean, default: false },
  instrumental: { type: Boolean, default: false },
  aiGenerated:  { type: Boolean, default: false },
  featuredArtists: { type: String, default: "" },
  versionInfo:  { type: String, default: "" }, // normal | radio-edit | other

  // ── Platforms selected by artist ──
  selectedPlatforms: { type: [String], default: [] },

  // ── Social/artist links per song (optional grouping) ──
  spotifyArtistLink:   { type: String, default: "" },
  appleMusicArtistLink:{ type: String, default: "" },
  instagramLink:       { type: String, default: "" },
  facebookLink:        { type: String, default: "" },

  // ── Add-ons ──
  addons: {
    socialMediaPack:  { type: Boolean, default: false },
    discoveryPack:     { type: Boolean, default: false },
    storeMaximiser:    { type: Boolean, default: false },
    loudnessNormalize: { type: Boolean, default: false },
    leaveLegacy:       { type: Boolean, default: false },
  },

  // ── Pricing ──
  trackPrice:   { type: Number, default: 0.99 },

  // ── Files ──
  coverUrl:     { type: String },
  audioUrl:     { type: String },

  // ── Distribution tracking ──
  routeNoteUploaded:   { type: Boolean, default: false },
  routeNoteUploadDate: { type: Date },
  adminNote:           { type: String, default: "" },

  // ── Performance ──
  streams:      { type: Number, default: 0 },
  earnings:     { type: Number, default: 0 },
  platformData: {
    spotify:      { type: Number, default: 0 },
    appleMusic:   { type: Number, default: 0 },
    youtubeMusic: { type: Number, default: 0 },
    deezer:       { type: Number, default: 0 },
  },
  dailyStreams:  { type: [dailyStreamSchema], default: [] },
}, { timestamps: true });

export default mongoose.model("Song", songSchema);
