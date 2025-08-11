require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// -------------------- Mongoose Schemas ---------------------

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
  playerId: { type: String, required: true, unique: true },
  items: [{ name: String, amount: Number }],
});
const Inventory = mongoose.model('Inventory', inventorySchema);

const eventLogSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, required: true },
  summary: { type: String, required: true },
  feeling: String,
  data: Object,
  requiresPlayerInput: Boolean,
  nextTrigger: String,
  urgency: { type: Number, default: 0 },
});
const EventLog = mongoose.model('EventLog', eventLogSchema);

const npcEventLogSchema = new mongoose.Schema({
  npcId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  summary: { type: String, required: true },
  feeling: String,
  data: Object,
});
const NPCEventLog = mongoose.model('NPCEventLog', npcEventLogSchema);

const relationshipSchema = new mongoose.Schema({
  targetId: String,
  targetType: { type: String, enum: ['npc', 'player'] },
  attitude: String,
  publicAttitude: String,
  privateAttitude: String,
  revealed: { type: Boolean, default: false },
  notes: String,
}, { _id: false });

const memorySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  summary: String,
  feeling: String,
  data: Object,
  intensity: { type: Number, default: 50 },
}, { _id: false });

const npcSchema = new mongoose.Schema({
  npcId: { type: String, required: true, unique: true },
  name: String,
  location: String,
  personality: [String],
  mood: String,
  attitudeTowardPlayer: String,
  conflictLevel: { type: Number, default: 0 },
  lastConflictWithPlayer: Date,
  relationships: [relationshipSchema],
  memories: [memorySchema],
  state: Object,
  description: String,
  details: String,
  bio: String,
});
const NPC = mongoose.model('NPC', npcSchema);

// ------------------- MongoDB Connection ---------------------

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// ------------------- Helper: Simulate Real Person Lookup ---------------------

// This is a stub function to simulate looking up a real person by name.
// In a real implementation, you might query an external API or database.
async function findRealPersonByName(name) {
  // Example simple hardcoded matches
  const realPeople = {
    'danny devito': {
      description: 'American actor known for roles in film and television.',
      details: 'Famous for his unique voice and dynamic characters.',
      bio: 'Danny DeVito is an award-winning actor, producer, and director.',
    },
    'albert einstein': {
      description: 'Theoretical physicist who developed the theory of relativity.',
      details: 'One of the most influential scientists of the 20th century.',
      bio: 'Albert Einstein revolutionized physics with his theories and won the Nobel Prize in 1921.',
    },
    // Add more as needed
  };
  const key = name.toLowerCase();
  return realPeople[key] || null;
}

// ------------------- Routes ----------------------

app.get('/', (req, res) => res.json({ status: 'Server is running!', time: new Date().toISOString() }));

// Precheck route enhanced
app.post('/api/gpt-precheck', async (req, res) => {
  const { playerId, context, latestEntry } = req.body;
  if (!playerId) {
    return res.status(400).json({
      summary: 'Missing playerId',
      logicConsistent: false,
      errors: ['playerId is required'],
      nextActionsAllowed: [],
      dramaPresent: false,
      storyAdvancing: false,
      npcIndividualityMaintained: false,
      newCharactersDetected: false,
      instructionsAdhered: false
    });
  }

  try {
    const player = await Player.findOne({ playerId });
    const npcs = await NPC.find({});
    const logs = await EventLog.find({ playerId }).sort({ timestamp: -1 }).limit(50);

    let errors = [];

    // 1. Check if latest entry advances the story
    const storyAdvancing = (() => {
      if (!latestEntry || !latestEntry.summary) return false;
      const recentSummaries = logs.slice(0, 5).map(l => l.summary.toLowerCase());
      return !recentSummaries.includes(latestEntry.summary.toLowerCase());
    })();

    if (!storyAdvancing) errors.push('The latest story entry does not advance the story.');

    // 2. Check NPC individuality and info scope
    const npcIndividualityMaintained = (() => {
      for (const npc of npcs) {
        if (!npc.personality || npc.personality.length === 0) return false;
        for (const memory of npc.memories || []) {
          if (memory.summary && !logs.some(log => log.summary.includes(memory.summary))) {
            return false;
          }
        }
      }
      return true;
    })();

    if (!npcIndividualityMaintained) errors.push('NPC individuality or knowledge boundaries are not maintained.');

    // 3. Detect new characters in latestEntry
    const existingNpcIds = new Set(npcs.map(n => n.npcId));
    const newCharactersDetected = (() => {
      if (!latestEntry || !latestEntry.data || !latestEntry.data.characterIds) return false;
      for (const id of latestEntry.data.characterIds) {
        if (!existingNpcIds.has(id) && id !== playerId) {
          return true;
        }
      }
      return false;
    })();

    if (newCharactersDetected) {
      // Here you might trigger automatic NPC creation or notify the system to do so.
      // For example:
      // await autoCreateNewNPCs(latestEntry.data.characterIds, existingNpcIds);
      // This logic is left as a stub for future integration.
    }

    // 4. Drama and conflict detection (positive and negative)
    const hostileNPCs = npcs.filter(npc =>
      npc.attitudeTowardPlayer && !['friendly', 'neutral'].includes(npc.attitudeTowardPlayer)
    );
    const highConflictNPCs = npcs.filter(npc => npc.conflictLevel >= 50);
    const dramaLogs = logs.filter(log =>
      /argue|tension|refuse|yelled|betray|fight|secret|rivalry|competition|alliance/.test(log.summary.toLowerCase()) ||
      ['tense', 'excited', 'hopeful', 'nervous'].includes(log.feeling) ||
      log.urgency > 70
    );
    const dramaPresent = hostileNPCs.length > 0 || dramaLogs.length > 0 || highConflictNPCs.length > 0;

    if (!dramaPresent) errors.push('No dramatic conflict or positive drama detected.');

    // 5. Adherence to instructions - simplified validation
    const instructionsAdhered = (() => {
      if (!playerId || !context) return false;
      if (!latestEntry || !latestEntry.summary) return false;
      return true;
    })();

    if (!instructionsAdhered) errors.push('Instructions are not fully adhered to.');

    res.json({
      summary: 'Precheck completed',
      logicConsistent: errors.length === 0,
      errors,
      nextActionsAllowed: [],
      dramaPresent,
      storyAdvancing,
      npcIndividualityMaintained,
      newCharactersDetected,
      instructionsAdhered
    });

  } catch (err) {
    res.status(500).json({
      summary: 'Server error',
      logicConsistent: false,
      errors: [err.message],
      nextActionsAllowed: [],
      dramaPresent: false,
      storyAdvancing: false,
      npcIndividualityMaintained: false,
      newCharactersDetected: false,
      instructionsAdhered: false
    });
  }
});

// New endpoint to create a detailed NPC character profile
app.post('/api/npc/create-character', async (req, res) => {
  const { npcId, name, description, details, bio, isHistorical = false } = req.body;

  if (!npcId || !name || !description || !details || !bio) {
    return res.status(400).json({ error: 'npcId, name, description, details, and bio are required.' });
  }

  try {
    let finalDescription = description;
    let finalDetails = details;
    let finalBio = bio;

    if (isHistorical) {
      // Attempt to find real person data
      const realPersonData = await findRealPersonByName(name);
      if (realPersonData) {
        finalDescription = realPersonData.description;
        finalDetails = realPersonData.details;
        finalBio = realPersonData.bio;
      }
    }

    // Check if NPC already exists
    let npc = await NPC.findOne({ npcId });
    if (npc) {
      return res.status(400).json({ error: 'NPC with this npcId already exists.' });
    }

    npc = new NPC({
      npcId,
      name,
      description: finalDescription,
      details: finalDetails,
      bio: finalBio,
      personality: [],
      mood: null,
      attitudeTowardPlayer: null,
      conflictLevel: 0,
      lastConflictWithPlayer: null,
      relationships: [],
      memories: [],
      state: {},
      location: null,
    });

    await npc.save();

    // Log NPC creation event
    await NPCEventLog.create({
      npcId,
      summary: `NPC ${name} created with detailed profile.`,
      feeling: 'neutral',
      data: { description: finalDescription, details: finalDetails, bio: finalBio }
    });

    res.json(npc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remaining original routes unchanged (player, npc, event logs, inventory, etc.)

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

app.get('/api/player/:playerId', async (req, res) => {
  try {
    const player = await Player.findOne({ playerId: req.params.playerId });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (err) {
    res.status(400).json({ error: err.message });
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

app.post('/api/npc', async (req, res) => {
  try {
    const { npcId, name, location, personality, mood, attitudeTowardPlayer, conflictLevel, lastConflictWithPlayer, relationships, memories, state, description, details, bio } = req.body;
    if (!npcId) return res.status(400).json({ error: 'npcId required' });
    const npc = await NPC.create({ npcId, name, location, personality, mood, attitudeTowardPlayer, conflictLevel, lastConflictWithPlayer, relationships, memories, state, description, details, bio });
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
    res.status(400).json({ error: err.message });
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

app.post('/api/log-event', async (req, res) => {
  try {
    const { playerId, type, summary, feeling, data, requiresPlayerInput, nextTrigger, urgency } = req.body;
    if (!playerId || !type || !summary) return res.status(400).json({ error: 'playerId, type, and summary required' });
    const log = await EventLog.create({ playerId, type, summary, feeling, data, requiresPlayerInput, nextTrigger, urgency });
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

app.get('/api/inventory/:playerId', async (req, res) => {
  try {
    const inv = await Inventory.findOne({ playerId: req.params.playerId });
    res.json(inv || { playerId: req.params.playerId, items: [] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/log-batch-events', async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events)) return res.status(400).json({ error: 'Invalid events array' });
    const results = [];
    for (const event of events) {
      if (event.entityType === 'player') {
        const log = await EventLog.create({ playerId: event.entityId, type: 'event', summary: event.summary, feeling: event.feeling, data: event.data, requiresPlayerInput: event.requiresPlayerInput, nextTrigger: event.nextTrigger, urgency: event.urgency });
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


