require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();

// Middleware
app.use(bodyParser.json());

// CORS configuration
const allowedOrigins = [
  "https://wonwonleywonmusic.com",
  "http://localhost:3000",
  "http://localhost:5174" ,
  "http://localhost:5173" 
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
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Session middleware configuration
app.use(
  session({
    secret: 'your_secret_key', // Secret for signing the session ID cookie
    resave: false, // Don't resave the session if nothing has changed
    saveUninitialized: false, // Don't save an uninitialized session
    cookie: { secure: false } // Set to true in production (requires HTTPS)
  })
);

// // MongoDB connection
// const MONGO_URI =
//   "mongodb+srv://jp-sanshtech:Sanjam%402310@artistdb.6joux.mongodb.net/artistsDB?retryWrites=true&w=majority";

// mongoose
//   .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => console.log("Connected to MongoDB"))
//   .catch((err) => console.error("Database connection error:", err));

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Database connection error:", err));

// Schemas and Models
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

// Authentication Middleware
function authenticate(req, res, next) {
  if (!req.session.admin) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Get All Artists (Public)
app.get("/api/artists", async (req, res) => {
  try {
    const artists = await Artist.find().sort({ order: 1 });
    res.status(200).json(artists);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login Endpoint (Session-based)
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Create a session for the user
    req.session.admin = { username }; // Store session data

    res.status(200).json({ message: "Login successful" });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Logout Endpoint (Session-based)
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to log out" });
    }
    res.status(200).json({ message: "Logout successful" });
  });
});

// Add Artist (Authenticated)
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

// Delete Artist (Authenticated)
app.delete("/api/admin/artists/delete/:id", authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const deletedArtist = await Artist.findByIdAndDelete(id);
    if (!deletedArtist) {
      return res.status(404).json({ error: "Artist not found" });
    }
    res.status(200).json({ message: "Artist deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete artist" });
  }
});

// Reorder Artists (Authenticated)
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

app.get("/api/admin/artists", authenticate, async (req, res) => {
  try {
    const artists = await Artist.find().sort({ order: 1 });
    res.status(200).json(artists);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch artists" });
  }
});
// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
