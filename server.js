require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();

// ✅ CORS Configuration
const allowedOrigins = [
  "https://wonwonleywontalent.com",
  "https://www.wonwonleywontalent.com",
  "https://wonwonleywonmusic.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// ✅ Session Configuration
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,          // ✅ for HTTPS (required on Render)
    sameSite: 'none'       // ✅ to allow cross-origin cookies from Vercel
  }
}));

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("Connected to MongoDB"))
.catch(err => console.error("Database connection error:", err));

// ✅ Schemas
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
});
const Admin = mongoose.model("Admin", adminSchema);

const artistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  instagramUrl: { type: String },
  order: { type: Number },
});
const Artist = mongoose.model("Artist", artistSchema);

// ✅ Authentication Middleware
function authenticate(req, res, next) {
  if (!req.session.admin) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ✅ Public Routes
app.get("/api/artists", async (req, res) => {
  try {
    const artists = await Artist.find().sort({ order: 1 });
    res.status(200).json(artists);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password are required" });

  try {
    const admin = await Admin.findOne({ username });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    req.session.admin = { username };
    res.status(200).json({ message: "Login successful" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: "Failed to log out" });
    res.status(200).json({ message: "Logout successful" });
  });
});

// ✅ Admin Routes
app.get("/api/admin/artists", authenticate, async (req, res) => {
  try {
    const artists = await Artist.find().sort({ order: 1 });
    res.status(200).json(artists);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch artists" });
  }
});

app.post("/api/admin/artists/add", authenticate, async (req, res) => {
  const { name, instagramUrl, order } = req.body;
  try {
    const newArtist = new Artist({ name, instagramUrl, order });
    await newArtist.save();
    res.status(201).json(newArtist);
  } catch (error) {
    res.status(500).json({ error: "Failed to add artist" });
  }
});

app.delete("/api/admin/artists/delete/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Artist.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Artist not found" });
    res.status(200).json({ message: "Artist deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete artist" });
  }
});

app.post("/api/admin/artists/reorder", authenticate, async (req, res) => {
  const { reorderedArtists } = req.body;
  try {
    for (const artist of reorderedArtists) {
      await Artist.findByIdAndUpdate(artist._id, { order: artist.order });
    }
    res.status(200).json({ message: "Reorder saved successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to save order" });
  }
});

// ✅ Start the Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
