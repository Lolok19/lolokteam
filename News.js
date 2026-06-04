const { getDb } = require('../db');

class News {
  static async create({ title, content, imageUrl, category, userId }) {
    const db = getDb();
    const result = await db.run(
      'INSERT INTO news (title, content, imageUrl, category, userId) VALUES (?, ?, ?, ?, ?)',
      [title, content, imageUrl || '', category || 'club', userId]
    );
    return { id: result.lastID, title, content, imageUrl, category, userId };
  }
  static async findAll({ page = 1, limit = 5, search = '', category = '', authorId = '', sort = 'date', currentUserId = null }) {
    const db = getDb();
    const offset = (page - 1) * limit;
    let whereClause = '1=1';
    const params = [];
    if (search) {
      whereClause += ' AND (news.title LIKE ? OR news.content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      whereClause += ' AND news.category = ?';
      params.push(category);
    }
    if (authorId) {
      whereClause += ' AND news.userId = ?';
      params.push(authorId);
    }
    let orderBy = sort === 'date' ? 'ORDER BY news.createdAt DESC' : 'ORDER BY news.title ASC';
    const items = await db.all(`
      SELECT news.*, users.name as authorName,
        (SELECT COUNT(*) FROM likes WHERE likes.newsId = news.id) as likesCount,
        EXISTS(SELECT 1 FROM likes WHERE likes.newsId = news.id AND likes.userId = ?) as userLiked
      FROM news 
      JOIN users ON news.userId = users.id 
      WHERE ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `, [currentUserId || 0, ...params, limit, offset]);
    const totalResult = await db.get(`SELECT COUNT(*) as count FROM news WHERE ${whereClause}`, params);
    return { items, total: totalResult.count, page, limit };
  }
  static async findById(id) {
    const db = getDb();
    return await db.get(`
      SELECT news.*, users.name as authorName FROM news JOIN users ON news.userId = users.id WHERE news.id = ?
    `, [id]);
  }
  static async update(id, { title, content, imageUrl, category }) {
    const db = getDb();
    await db.run(
      'UPDATE news SET title = ?, content = ?, imageUrl = ?, category = ? WHERE id = ?',
      [title, content, imageUrl || '', category || 'club', id]
    );
    return await News.findById(id);
  }
  static async delete(id) {
    const db = getDb();
    await db.run('DELETE FROM news WHERE id = ?', [id]);
  }
  static async toggleLike(newsId, userId) {
    const db = getDb();
    const exists = await db.get('SELECT id FROM likes WHERE newsId = ? AND userId = ?', [newsId, userId]);
    if (exists) {
      await db.run('DELETE FROM likes WHERE id = ?', exists.id);
      return { liked: false };
    } else {
      await db.run('INSERT INTO likes (newsId, userId) VALUES (?, ?)', [newsId, userId]);
      return { liked: true };
    }
  }
}

module.exports = News;
