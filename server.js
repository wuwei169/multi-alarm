const express = require('express');
const webpush = require('web-push');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY env vars.');
  process.exit(1);
}

webpush.setVapidDetails(
  'mailto:admin@multialarm.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// In-memory store: sessionId -> { subscription, timeouts[] }
const sessions = new Map();

async function fireAlarm(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  try {
    await webpush.sendNotification(
      session.subscription,
      JSON.stringify({ title: 'Multi Alarm', body: "Time's up! ⏰" })
    );
  } catch (err) {
    console.error('Push error:', err.statusCode, err.body);
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription gone — clean up
      session.timeouts.forEach(clearTimeout);
      sessions.delete(sessionId);
    }
  }
}

app.get('/api/vapid-public-key', (req, res) => {
  res.json({ key: VAPID_PUBLIC_KEY });
});

app.post('/api/schedule', (req, res) => {
  const { sessionId, subscription, alarmTimes } = req.body;

  // Cancel any existing session for this id
  const existing = sessions.get(sessionId);
  if (existing) existing.timeouts.forEach(clearTimeout);

  const now = Date.now();
  const timeouts = alarmTimes.map(time => {
    const delay = Math.max(0, time - now);
    return setTimeout(() => fireAlarm(sessionId), delay);
  });

  sessions.set(sessionId, { subscription, timeouts });
  res.json({ ok: true });
});

app.post('/api/cancel', (req, res) => {
  const { sessionId } = req.body;
  const session = sessions.get(sessionId);
  if (session) {
    session.timeouts.forEach(clearTimeout);
    sessions.delete(sessionId);
  }
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
