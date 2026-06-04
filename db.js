const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

let db;

async function openDb() {
  const dbPath = process.env.NODE_ENV === 'production' 
    ? path.join('/opt/render/project/src/backend/data', 'database.sqlite')
    : path.join(__dirname, 'database.sqlite');
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Таблицы
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      imageUrl TEXT,
      category TEXT DEFAULT 'club',
      userId INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      number INTEGER UNIQUE,
      position TEXT,
      photoUrl TEXT,
      birthDate TEXT,
      nationality TEXT,
      stats TEXT
    );
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opponent TEXT NOT NULL,
      dateTime TEXT NOT NULL,
      venue TEXT,
      homeScore INTEGER,
      awayScore INTEGER,
      status TEXT DEFAULT 'upcoming'
    );
    CREATE TABLE IF NOT EXISTS favourites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      entityType TEXT NOT NULL,
      entityId INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id),
      UNIQUE(userId, entityType, entityId)
    );
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      newsId INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (newsId) REFERENCES news(id),
      UNIQUE(userId, newsId)
    );
  `);

  // Добавляем тестового администратора, если нет
  const adminExists = await db.get('SELECT * FROM users WHERE email = ?', ['admin@example.com']);
  if (!adminExists) {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('admin123', 10);
    await db.run(
      'INSERT INTO users (email, passwordHash, name, role) VALUES (?, ?, ?, ?)',
      ['admin@example.com', hash, 'Admin', 'admin']
    );
  }
  return db;
}

module.exports = { openDb, getDb: () => db };
