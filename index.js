const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// ---- Connect to MongoDB ----
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lifesim', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', (error) => console.error(error));
db.once('open', () => console.log('MongoDB connected'));

// ---- SCHEMAS ----
const eventLogSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, required: true },
  summary: { type: String, required: true },
  data: { type: Object },
});
const EventLog = mongoose.model('EventLog', eventLogSchema);

// Example schemas for demo; expand as needed!
const playerSchema = new mongoose.Schema({
  playerId: { type: String, required: true, unique: true },
  name: String,
  age: Number,
  location: String,
  stats: Object, // e.g. { health: 90, energy: 40 }
});
const Player = mongoose.model('Player', playerSchema);

const inventorySchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  items: [Object], // e.g. [{ name: 'Coffee', amount: 1 }]
});
const Inventory = mongoose.model('Inventory', inventorySchema);

const npcSchema = new mongoose.Schema({
  name: String,
  location: String,
  personality: [String],
  state: Object,
});
const NPC = mongoose.model('NPC', npcSchema);

// ---- EXPRESS SETUP ----
const app = express();
app.use(cors());
app.use(express.json());

// ---- ROUTES ----

// Log a new event
app.post('/api/log-event', async (req, res) => {
  try {
    const { playerId, type, summary, data } = req.body;
    if (!playerId || !type || !summary) return res.status(400).json({ error: 'Missing data' });
    const log = await EventLog.create({ playerId, type, summary, data });
    res.json({ success: true, log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recent event logs for a player
app.get('/api/event-log/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const logs = await EventLog.find({ playerId }).sort({ timestamp: -1 }).limit(limit);
    res.json({ logs: logs.reverse() }); // chronological order
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get full player state (expand as needed)
app.get('/api/player-state/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const player = await Player.findOne({ playerId });
    const inventory = await Inventory.findOne({ playerId });
    const npcs = await NPC.find({ location: player?.location });
    res.json({
      player,
      inventory: inventory?.items || [],
      npcs: npcs || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Start Server ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
