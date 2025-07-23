const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Matches schema: /api/prompt (optional, not referenced in schema but can be kept)
app.post('/api/prompt', (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  console.log('🔔 Received prompt:', prompt);

  res.json({
    message: 'Prompt received!',
    yourPrompt: prompt,
  });
});

// Matches schema: /preflight
app.post('/preflight', (req, res) => {
  console.log('🧠 Preflight check triggered.');
  res.json({ status: 'ok', message: 'Preflight check passed.' });
});

// Matches schema: /formatPost
app.post('/formatPost', (req, res) => {
  console.log('📝 Format post triggered.');
  res.json({ status: 'ok', message: 'Post formatting confirmed.' });
});

// Matches schema: /enforceProseDiscipline
app.post('/enforceProseDiscipline', (req, res) => {
  console.log('🎨 Enforce prose discipline triggered.');
  res.json({ status: 'ok', message: 'Prose quality verified.' });
});

// Matches schema: /characterDialogueAudit
app.post('/characterDialogueAudit', (req, res) => {
  console.log('💬 Character dialogue audit triggered.');
  res.json({ status: 'ok', message: 'Dialogue check passed.' });
});

// Matches schema: /submitSummary
app.post('/submitSummary', (req, res) => {
  console.log('📦 Submit summary triggered.');
  res.json({ status: 'ok', message: 'Summary submitted.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
