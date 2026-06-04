require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { openDb } = require('./db');
const authRoutes = require('./routes/auth');
const newsRoutes = require('./routes/news');
const playersRoutes = require('./routes/players');
const matchesRoutes = require('./routes/matches');
const favouritesRoutes = require('./routes/favourites');
const usersRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth', authRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/favourites', favouritesRoutes);
app.use('/api/users', usersRoutes);

app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

async function start() {
  await openDb();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start();
