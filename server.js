require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static('public'));

// Helper: get user from Authorization header
async function getUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  
  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);
  
  if (error || !data.user) return null;
  return data.user;
}

// ============================================
// API ROUTES
// ============================================

// POST /api/log
app.post('/api/log', async (req, res) => {
  try {
    const { content, title } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }

    const user = await getUser(req);
    const userId = user ? user.id : null;

    const { data, error } = await supabase
      .from('logs')
      .insert({
        content,
        title: title || null,
        size_bytes: Buffer.byteLength(content, 'utf8'),
        user_id: userId,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to create log' });
    }

    res.json({ id: data.id });
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/log/:id
app.get('/api/log/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) {
      console.error('Supabase select error:', error);
      return res.status(404).json({ error: 'Not found', details: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json(data);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/log/:id/raw
app.get('/api/log/:id/raw', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('logs')
      .select('content, title')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).send('Not found');
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(data.content);
  } catch (err) {
    res.status(500).send('Error');
  }
});

// GET /api/me
app.get('/api/me', async (req, res) => {
  const user = await getUser(req);
  res.json({ user: user ? { id: user.id, email: user.email } : null });
});

// GET /api/my-logs
app.get('/api/my-logs', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    const { data, error } = await supabase
      .from('logs')
      .select('id, title, created_at, size_bytes')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch logs' });
    }

    res.json(data || []);
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/config
// Serves Supabase credentials to frontend
// The anon key is public by design, but this keeps it in one place
app.get('/api/config', (req, res) => {
  res.json({
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY
  });
});

// SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('Logshare running at http://localhost:' + PORT);
});
