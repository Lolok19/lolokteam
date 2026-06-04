const { getDb } = require('../db');

class Favourite {
  static async add(userId, entityType, entityId) {
    const db = getDb();
    try {
      await db.run(
        'INSERT INTO favourites (userId, entityType, entityId) VALUES (?, ?, ?)',
        [userId, entityType, entityId]
      );
      return true;
    } catch (err) { return false; }
  }
  static async remove(userId, entityType, entityId) {
    const db = getDb();
    await db.run('DELETE FROM favourites WHERE userId = ? AND entityType = ? AND entityId = ?', [userId, entityType, entityId]);
  }
  static async getUserFavourites(userId) {
    const db = getDb();
    const favs = await db.all('SELECT * FROM favourites WHERE userId = ?', [userId]);
    // Дополним данными матчей
    const enriched = [];
    for (let fav of favs) {
      if (fav.entityType === 'matches') {
        const match = await db.get('SELECT * FROM matches WHERE id = ?', [fav.entityId]);
        if (match) enriched.push({ ...fav, opponent: match.opponent, dateTime: match.dateTime });
      }
    }
    return enriched;
  }
}

module.exports = Favourite;
