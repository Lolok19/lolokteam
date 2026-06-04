const { getDb } = require('../db');

class Match {
  static async create({ opponent, dateTime, venue, homeScore, awayScore, status }) {
    const db = getDb();
    const result = await db.run(
      'INSERT INTO matches (opponent, dateTime, venue, homeScore, awayScore, status) VALUES (?, ?, ?, ?, ?, ?)',
      [opponent, dateTime, venue, homeScore || null, awayScore || null, status || 'upcoming']
    );
    return { id: result.lastID, opponent, dateTime };
  }
  static async findAll() {
    const db = getDb();
    return await db.all('SELECT * FROM matches ORDER BY dateTime');
  }
  static async findById(id) {
    const db = getDb();
    return await db.get('SELECT * FROM matches WHERE id = ?', [id]);
  }
  static async delete(id) {
    const db = getDb();
    await db.run('DELETE FROM matches WHERE id = ?', [id]);
  }
}

module.exports = Match;
