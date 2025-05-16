// ✅ Required Dependencies
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key";

// ✅ CORS Configuration
const allowedOrigins = [
  "https://wonwonmusic-frontend.vercel.app",
  "https://wonwonleywonmusic.com",
  "https://www.wonwonleywonmusic.com",
];

app.use(
  cors({
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
  })
);

// ✅ Handle preflight OPTIONS requests
app.options("*", cors());
app.use(express.json());

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ✅ Schemas
const Admin = mongoose.model("Admin", new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
}));

const Artist = mongoose.model("Artist", new mongoose.Schema({
  name: { type: String, required: true },
  instagramUrl: { type: String },
  order: { type: Number },
}));

// ✅ Auth Middleware
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token missing" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ✅ Public Route - List Artists
app.get("/api/artists", async (req, res) => {
  try {
    const artists = await Artist.find().sort({ order: 1 });
    res.json(artists);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Admin Login (JWT Auth)
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });

  try {
    const admin = await Admin.findOne({ username });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: admin._id, username: admin.username }, JWT_SECRET, {
      expiresIn: "2h",
    });

    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Protected Admin Routes
app.get("/api/admin/artists", authenticate, async (req, res) => {
  const artists = await Artist.find().sort({ order: 1 });
  res.json(artists);
});

app.post("/api/admin/artists/add", authenticate, async (req, res) => {
  const { name, instagramUrl, order } = req.body;
  try {
    const newArtist = new Artist({ name, instagramUrl, order });
    await newArtist.save();
    res.status(201).json(newArtist);
  } catch (err) {
    res.status(500).json({ error: "Failed to add artist" });
  }
});

app.delete("/api/admin/artists/delete/:id", authenticate, async (req, res) => {
  try {
    const deleted = await Artist.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Artist not found" });
    res.json({ message: "Artist deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete artist" });
  }
});

app.post("/api/admin/artists/reorder", authenticate, async (req, res) => {
  try {
    for (const artist of req.body.reorderedArtists) {
      await Artist.findByIdAndUpdate(artist._id, { order: artist.order });
    }
    res.json({ message: "Reorder saved successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to save order" });
  }
});

// ✅ Optional: Admin Register (disable after use)
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const newAdmin = new Admin({ username, password: hashedPassword });
    await newAdmin.save();
    res.status(201).json({ message: "Admin created" });
  } catch (err) {
    res.status(500).json({ error: "Failed to register admin" });
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
