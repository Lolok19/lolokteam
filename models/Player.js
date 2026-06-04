const { getDb } = require('../db');

class Player {
  static async create({ name, number, position, photoUrl, birthDate, nationality, stats }) {
    const db = getDb();
    const result = await db.run(
      'INSERT INTO players (name, number, position, photoUrl, birthDate, nationality, stats) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, number, position, photoUrl || '', birthDate || '', nationality || '', stats || '']
    );
    return { id: result.lastID, name, number };
  }
  static async findAll() {
    const db = getDb();
    return await db.all('SELECT * FROM players ORDER BY number');
  }
  static async findById(id) {
    const db = getDb();
    return await db.get('SELECT * FROM players WHERE id = ?', [id]);
  }
  static async delete(id) {
    const db = getDb();
    await db.run('DELETE FROM players WHERE id = ?', [id]);
  }
}

module.exports = Player;
