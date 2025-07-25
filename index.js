const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// ---- Connect to MongoDB Atlas ----
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Fail fast if DB can't connect
  });

// ---- SCHEMAS ----
const npcEventLogSchema = new mongoose.Schema({
  npcId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  summary: { type: String, required: true },
  feeling: { type: String },
  data: { type: Object },
});
const NPCEventLog = mongoose.model('NPCEventLog', npcEventLogSchema);

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

const relationshipSchema = new mongoose.Schema({
  targetId: String,
  targetType: { type: String, enum: ['npc', 'player'] },
  attitude: String,
  notes: String,
}, { _id: false });

const memorySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  summary: String,
  feeling: String,
  data: Object,
}, { _id: false });

const npcSchema = new mongoose.Schema({
  npcId: { type: String, required: true, unique: true },
  name: String,
  location: String,
  personality: [String],
  mood: String,
  attitudeTowardPlayer: String,
  relationships: [relationshipSchema],
  memories: [memorySchema],
  state: Object,
});
const NPC = mongoose.model('NPC', npcSchema);

// ---- EXPRESS SETUP ----
const app = express();
app.use(cors());
app.use(express.json());

// ---- Friendly root endpoint for testing ----
app.get('/', (req, res) => {
  res.json({ status: 'Server is running!', time: new Date().toISOString() });
});

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

// Precheck endpoint
app.post('/api/gpt-precheck', async (req, res) => {
  try {
    const { playerId, context } = req.body;
    let errors = [];
    let logicConsistent = true;
    let summary = "";
    let nextActionsAllowed = ["continue", "clarify", "abort"];
    const player = await Player.findOne({ playerId });
    if (!player) {
      errors.push('Player not found.');
      logicConsistent = false;
    } else if (!player.location) {
      errors.push('Player location missing.');
      logicConsistent = false;
    }
    if (context && context.npcs && Array.isArray(context.npcs)) {
      context.npcs.forEach(npc => {
        if (!npc.personality || npc.personality.length === 0)
          errors.push(`NPC ${npc.name} is missing personality traits.`);
        if (!npc.mood)
          errors.push(`NPC ${npc.name} is missing current mood.`);
      });
    }
    if (errors.length === 0) {
      summary = "State and story logic are consistent. All rules and guidelines satisfied.";
      logicConsistent = true;
    } else {
      summary = "Issues found. Please resolve errors before proceeding.";
      logicConsistent = false;
    }
    res.json({ summary, logicConsistent, errors, nextActionsAllowed });
  } catch (err) {
    res.status(500).json({ summary: "Server error during precheck.", logicConsistent: false, errors: [err.message], nextActionsAllowed: [] });
  }
});

// ---- PLAYER CRUD ----
app.post('/api/player', async (req, res) => {
  try {
    const player = await Player.create(req.body);
    res.json(player);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.get('/api/player/:playerId', async (req, res) => {
  try {
    const player = await Player.findOne({ playerId: req.params.playerId });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.patch('/api/player/:playerId', async (req, res) => {
  try {
    const player = await Player.findOneAndUpdate({ playerId: req.params.playerId }, req.body, { new: true });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.delete('/api/player/:playerId', async (req, res) => {
  try {
    const player = await Player.findOneAndDelete({ playerId: req.params.playerId });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---- NPC CRUD ----
app.post('/api/npc', async (req, res) => {
  try {
    const npc = await NPC.create(req.body);
    res.json(npc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.get('/api/npc/:npcId', async (req, res) => {
  try {
    const npc = await NPC.findOne({ npcId: req.params.npcId });
    if (!npc) return res.status(404).json({ error: 'NPC not found' });
    res.json(npc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.patch('/api/npc/:npcId', async (req, res) => {
  try {
    const npc = await NPC.findOneAndUpdate({ npcId: req.params.npcId }, req.body, { new: true });
    if (!npc) return res.status(404).json({ error: 'NPC not found' });
    res.json(npc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.delete('/api/npc/:npcId', async (req, res) => {
  try {
    const npc = await NPC.findOneAndDelete({ npcId: req.params.npcId });
    if (!npc) return res.status(404).json({ error: 'NPC not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---- LOGGING & STATE ----

// Log a new event for player
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
// Log a new event for NPC
app.post('/api/log-npc-event', async (req, res) => {
  try {
    const { npcId, summary, feeling, data } = req.body;
    if (!npcId || !summary) return res.status(400).json({ error: 'Missing data' });
    const log = await NPCEventLog.create({ npcId, summary, feeling, data });
    await NPC.updateOne(
      { npcId },
      { $push: { memories: { summary, feeling, data, timestamp: new Date() } } }
    );
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
    res.json({ logs: logs.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recent event logs for an NPC
app.get('/api/npc-event-log/:npcId', async (req, res) => {
  try {
    const { npcId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const logs = await NPCEventLog.find({ npcId }).sort({ timestamp: -1 }).limit(limit);
    res.json({ logs: logs.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get full player state, including visible NPCs and formatted time
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
        stats: { money: player.stats.money }
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
