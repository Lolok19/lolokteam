const { getDb } = require('../db');
const bcrypt = require('bcrypt');

class User {
  static async create({ email, password, name }) {
    const db = getDb();
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO users (email, passwordHash, name) VALUES (?, ?, ?)',
      [email, passwordHash, name]
    );
    return { id: result.lastID, email, name, role: 'user' };
  }
  static async findByEmail(email) {
    const db = getDb();
    return await db.get('SELECT * FROM users WHERE email = ?', [email]);
  }
  static async findById(id) {
    const db = getDb();
    return await db.get('SELECT id, email, name, role, createdAt FROM users WHERE id = ?', [id]);
  }
  static async findAll() {
    const db = getDb();
    return await db.all('SELECT id, name, email, role FROM users');
  }
}

module.exports = User;
