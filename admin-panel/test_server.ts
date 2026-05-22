import express from 'express';
import handler from './api/telegram-webhook';

const app = express();
app.use(express.json());

app.post('/api/telegram-webhook', async (req, res) => {
  try {
    await handler(req as any, res as any);
  } catch (err) {
    console.error("FATAL ERROR IN HANDLER:", err);
    res.status(500).send("FAILED");
  }
});

app.listen(3001, () => {
  console.log('Test server running on port 3001');
  
  // Make a test request to itself
  fetch('http://localhost:3001/api/telegram-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { text: 'test' } })
  })
  .then(res => res.text())
  .then(text => {
    console.log("RESPONSE:", text);
    process.exit(0);
  })
  .catch(err => {
    console.error("FETCH ERROR:", err);
    process.exit(1);
  });
});
