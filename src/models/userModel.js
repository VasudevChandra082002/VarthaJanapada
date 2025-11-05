

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema({
  phone_Number: {
    type: Number,
    unique: true,
    sparse: true
  },
    firebaseUid: {
    type: String,
    unique: true,
    sparse: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    select: false
  },
  role: {
    type: String,
    enum: ["admin", "moderator", "user", "content"],
    default: "user",
  },  
  displayName: {
    type: String,
    required: false,
  }, 
  createdTime: {
    type: Date,
    default: Date.now,
  },
  last_logged_in: {
    type: Date,
  },
  refreshToken: {
    type: String,
    select: false
  },
  fcmToken: {
    type: String,
  },
  profileImage: {
    type: String,
  },
  preferences: {
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
  },
  clickedNews: [
    {
      newsId: { type: mongoose.Schema.Types.ObjectId, ref: "News" },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  likedNews: [
    {
      newsId: { type: mongoose.Schema.Types.ObjectId, ref: "News" },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  likedVideos: [
    {
      videoId: { type: mongoose.Schema.Types.ObjectId, ref: "Video" },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  categoryPreferences: {
    type: Map,
    of: Number,
    default: {},
  },

  playlist: {
  newsplaylist: [
    {
      newsId: { type: mongoose.Schema.Types.ObjectId, ref: "News" },
      addedAt: { type: Date, default: Date.now },
    },
  ],
   shortvideoplaylist: [
      {
        videoId: { type: mongoose.Schema.Types.ObjectId, ref: "Video" },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    longvideoplaylist: [
      {
        videoId: { type: mongoose.Schema.Types.ObjectId, ref: "LongVideo" },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    varthaJanapadaplaylist: [
      {
        magazineId: { type: mongoose.Schema.Types.ObjectId, ref: "Magazine" },
        addedAt: { type: Date, default: Date.now },
      },
    ],
 marchofkarnatakaplaylist: [
      {
        magazineId: { type: mongoose.Schema.Types.ObjectId, ref: "Magazine2" },
        addedAt: { type: Date, default: Date.now },
      },
    ],

},
});

// Method to generate JWT tokens
userSchema.methods.generateAuthToken = function() {
  const accessToken = jwt.sign(
    { 
      id: this._id, 
      email: this.email, 
      role: this.role 
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '7d' } 
  );
  
  const refreshToken = jwt.sign(
    { id: this._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

module.exports = mongoose.model("User", userSchema);
