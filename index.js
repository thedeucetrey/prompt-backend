const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { parseISO, add } = require('date-fns');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

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
  feeling: { type: String },
  data: { type: Object },
  requiresPlayerInput: { type: Boolean },
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

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'Server is running!', time: new Date().toISOString() });
});

function getFormattedTime(date = new Date()) {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
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

function applyTimeDelta(base, deltaStr) {
  try {
    const duration = deltaStr.match(/P.*T.*/g) ? parseISO(`1970-01-01T00:00:00${deltaStr}`) : null;
    return duration ? add(base, duration) : base;
  } catch {
    return base;
  }
}

app.post('/api/log-batch-events', async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events)) return res.status(400).json({ error: 'Invalid events array' });
    const results = [];
    for (const event of events) {
      const { entityType, entityId, summary, feeling, data, timeDelta, requiresPlayerInput } = event;
      const timestamp = applyTimeDelta(new Date(), timeDelta);
      if (entityType === 'player') {
        const log = await EventLog.create({ playerId: entityId, type: 'event', summary, feeling, data, requiresPlayerInput, timestamp });
        results.push(log);
      } else if (entityType === 'npc') {
        const log = await NPCEventLog.create({ npcId: entityId, summary, feeling, data, timestamp });
        await NPC.updateOne({ npcId: entityId }, { $push: { memories: { summary, feeling, data, timestamp } } });
        results.push(log);
      }
    }
    res.json({ success: true, logs: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/npc/:npcId', async (req, res) => {
  try {
    const { syncFromLogs, ...updateData } = req.body;
    const npc = await NPC.findOneAndUpdate({ npcId: req.params.npcId }, updateData, { new: true });
    if (!npc) return res.status(404).json({ error: 'NPC not found' });
    if (syncFromLogs) {
      const logs = await NPCEventLog.find({ npcId: req.params.npcId }).sort({ timestamp: -1 }).limit(5);
      if (logs.length > 0) npc.mood = logs[0].feeling;
      await npc.save();
    }
    res.json(npc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/player/:playerId', async (req, res) => {
  try {
    const { syncFromLogs, ...updateData } = req.body;
    const player = await Player.findOneAndUpdate({ playerId: req.params.playerId }, updateData, { new: true });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    if (syncFromLogs) {
      const logs = await EventLog.find({ playerId: req.params.playerId }).sort({ timestamp: -1 }).limit(5);
      if (logs.length > 0 && logs[0].data?.moneyChange) {
        player.stats.money += logs[0].data.moneyChange;
        await player.save();
      }
    }
    res.json(player);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// You can retain your original routes here...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


