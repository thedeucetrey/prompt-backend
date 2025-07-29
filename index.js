// backend/index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// -------------------- Mongoose Schemas ---------------------

// --- Player ---
const playerSchema = new mongoose.Schema({
  playerId: { type: String, required: true, unique: true },
  name: String,
  location: String,
  stats: {
    money: { type: Number, default: 0 },
  },
});
const Player = mongoose.model('Player', playerSchema);

// --- Inventory ---
const inventorySchema = new mongoose.Schema({
  playerId: { type: String, required: true, unique: true },
  items: [
    { name: String, amount: Number },
  ],
});
const Inventory = mongoose.model('Inventory', inventorySchema);

// --- Event Log ---
const eventLogSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, required: true },
  summary: { type: String, required: true },
  feeling: String,
  data: Object,
  requiresPlayerInput: Boolean,
});
const EventLog = mongoose.model('EventLog', eventLogSchema);

// --- NPC ---
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

// --- NPC Event Log ---
const npcEventLogSchema = new mongoose.Schema({
  npcId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  summary: { type: String, required: true },
  feeling: String,
  data: Object,
});
const NPCEventLog = mongoose.model('NPCEventLog', npcEventLogSchema);

// ------------------- MongoDB Connection ---------------------

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// ------------------- Routes ----------------------

// Root
app.get('/', (req, res) => res.json({ status: 'Server is running!', time: new Date().toISOString() }));

// ----------- PLAYER ROUTES -----------

// Create Player
app.post('/api/player', async (req, res) => {
  try {
    const { playerId, name, location, stats } = req.body;
    if (!playerId) return res.status(400).json({ error: 'playerId required' });
    const player = await Player.create({ playerId, name, location, stats });
    res.json(player);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get Player
app.get('/api/player/:playerId', async (req, res) => {
  try {
    const player = await Player.findOne({ playerId: req.params.playerId });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update Player
app.patch('/api/player/:playerId', async (req, res) => {
  try {
    const player = await Player.findOneAndUpdate({ playerId: req.params.playerId }, req.body, { new: true });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ----------- NPC ROUTES -----------

// Create NPC
app.post('/api/npc', async (req, res) => {
  try {
    const { npcId, name, location, personality, mood, attitudeTowardPlayer, relationships, memories, state } = req.body;
    if (!npcId) return res.status(400).json({ error: 'npcId required' });
    const npc = await NPC.create({ npcId, name, location, personality, mood, attitudeTowardPlayer, relationships, memories, state });
    res.json(npc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get NPC
app.get('/api/npc/:npcId', async (req, res) => {
  try {
    const npc = await NPC.findOne({ npcId: req.params.npcId });
    if (!npc) return res.status(404).json({ error: 'NPC not found' });
    res.json(npc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update NPC
app.patch('/api/npc/:npcId', async (req, res) => {
  try {
    const npc = await NPC.findOneAndUpdate({ npcId: req.params.npcId }, req.body, { new: true });
    if (!npc) return res.status(404).json({ error: 'NPC not found' });
    res.json(npc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ----------- EVENT LOG ROUTES -----------

// Player Event Log
app.post('/api/log-event', async (req, res) => {
  try {
    const { playerId, type, summary, feeling, data, requiresPlayerInput } = req.body;
    if (!playerId || !type || !summary) return res.status(400).json({ error: 'playerId, type, and summary required' });
    const log = await EventLog.create({ playerId, type, summary, feeling, data, requiresPlayerInput });
    res.json(log);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/log-event/:playerId', async (req, res) => {
  try {
    const logs = await EventLog.find({ playerId: req.params.playerId }).sort({ timestamp: -1 }).limit(100);
    res.json({ logs });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// NPC Event Log
app.post('/api/log-npc-event', async (req, res) => {
  try {
    const { npcId, summary, feeling, data } = req.body;
    if (!npcId || !summary) return res.status(400).json({ error: 'npcId and summary required' });
    const log = await NPCEventLog.create({ npcId, summary, feeling, data });
    await NPC.updateOne({ npcId }, { $push: { memories: { summary, feeling, data } } });
    res.json(log);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ----------- INVENTORY ROUTES -----------

// Create/Update Inventory for Player
app.post('/api/inventory', async (req, res) => {
  try {
    const { playerId, items } = req.body;
    if (!playerId) return res.status(400).json({ error: 'playerId required' });
    const inv = await Inventory.findOneAndUpdate({ playerId }, { items }, { new: true, upsert: true });
    res.json(inv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get Inventory
app.get('/api/inventory/:playerId', async (req, res) => {
  try {
    const inv = await Inventory.findOne({ playerId: req.params.playerId });
    res.json(inv || { playerId: req.params.playerId, items: [] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ----------- BATCH EVENTS (Advanced / Optional) -----------

// Batch Logging (Player/NPC)
app.post('/api/log-batch-events', async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events)) return res.status(400).json({ error: 'Invalid events array' });
    const results = [];
    for (const event of events) {
      if (event.entityType === 'player') {
        const log = await EventLog.create({ playerId: event.entityId, type: 'event', summary: event.summary, feeling: event.feeling, data: event.data, requiresPlayerInput: event.requiresPlayerInput });
        results.push(log);
      } else if (event.entityType === 'npc') {
        const log = await NPCEventLog.create({ npcId: event.entityId, summary: event.summary, feeling: event.feeling, data: event.data });
        await NPC.updateOne({ npcId: event.entityId }, { $push: { memories: { summary: event.summary, feeling: event.feeling, data: event.data } } });
        results.push(log);
      }
    }
    res.json({ success: true, logs: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------- Start Server -----------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


