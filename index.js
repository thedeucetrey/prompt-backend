// index.js
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

const playerSchema = new mongoose.Schema({
  playerId: { type: String, required: true, unique: true },
  name: String,
  location: String,
  stats: {
    money: { type: Number, default: 0 },
    // add more stats as needed
  },
});
const Player = mongoose.model('Player', playerSchema);

const inventorySchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  items: [
    {
      name: String,
      amount: Number,
    },
  ],
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

// ---- HELPERS ----
function getFormattedTime(date = new Date()) {
  const dayNames = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
  ];
  const monthNames = [
    "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"
  ];
  const dayOfWeek = dayNames[date.getDay()];
  const day = date.getDate();
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  let hour = date.getHours();
  const ampm = hour >= 12 ? 'pm' : 'am';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  const minute = date.getMinutes().toString().padStart(2, '0');
  return `${dayOfWeek}, ${day} ${month}, ${year}, ${hour}:${minute} ${ampm}`;
}

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

// Get full player state, including formatted time, location, and money
app.get('/api/player-state/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const player = await Player.findOne({ playerId });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    const inventory = await Inventory.findOne({ playerId });
    const npcs = await NPC.find({ location: player.location });
    const currentTime = getFormattedTime();
    res.json({
      player: {
        playerId: player.playerId,
        name: player.name,
        location: player.location,
        stats: {
          money: player.stats.money
        }
      },
      inventory: inventory?.items || [],
      npcs: npcs || [],
      currentTime
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Start Server ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

