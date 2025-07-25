const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

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

app.post('/runPreflight', (req, res) => {
  console.log('🧠 Preflight check triggered.');
  res.json({ status: 'ok', message: 'Preflight check passed.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
