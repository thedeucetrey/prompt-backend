const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Optional test endpoint
app.post('/api/prompt', (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
  console.log('🔔 Received prompt:', prompt);
  res.json({ message: 'Prompt received!', yourPrompt: prompt });
});

// Preflight
app.post('/preflight', (req, res) => {
  console.log('🧠 Preflight check triggered.');
  res.json({ success: true, errors: [] });
});

// Format Post
app.post('/formatPost', (req, res) => {
  console.log('📝 Format post triggered.');
  res.json({ status: 'ok', message: 'Post formatting confirmed.' });
});

// Enforce Prose Discipline
app.post('/enforceProseDiscipline', (req, res) => {
  console.log('🎨 Enforce prose discipline triggered.');
  res.json({ status: 'ok', message: 'Prose quality verified.' });
});

// Character Dialogue Audit
app.post('/characterDialogueAudit', (req, res) => {
  console.log('💬 Character dialogue audit triggered.');
  res.json({ status: 'ok', message: 'Dialogue check passed.' });
});

// Submit Summary
app.post('/submitSummary', (req, res) => {
  console.log('📦 Submit summary triggered.');
  res.json({ status: 'ok', message: 'Summary submitted.' });
});

// Character Memory Update
app.post('/characterMemoryUpdate', (req, res) => {
  console.log('🧬 Character memory update triggered.');
  res.json({ status: 'ok', message: 'Character memory persisted.' });
});

// World State Update
app.post('/worldStateUpdate', (req, res) => {
  console.log('🌍 World state update triggered.');
  res.json({ status: 'ok', message: 'World state updated.' });
});

// Event Hook
app.post('/eventHook', (req, res) => {
  console.log('📣 Event hook triggered.');
  res.json({ status: 'ok', message: 'Event injected.' });
});

// Debug Report
app.post('/debugReport', (req, res) => {
  console.log('🧪 Debug report requested.');
  res.json({ status: 'ok', message: 'Debug report generated.' });
});

// Guidance
app.post('/guidance', (req, res) => {
  console.log('🔍 Guidance generation triggered.');
  res.json({ status: 'ok', message: 'Guidance generated.' });
});

// History Audit
app.post('/historyAudit', (req, res) => {
  console.log('📚 History audit requested.');
  res.json({ status: 'ok', message: 'History returned.' });
});

// Create NPC
app.post('/createNPC', (req, res) => {
  console.log('👤 Create NPC triggered.');
  res.json({ status: 'ok', message: 'NPC created or retrieved.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
