const { getDatabase } = require('../utils/database');

class User {
  constructor() {
    this.db = getDatabase();
    this.table = 'users';
  }

  // Create a new user
  create(userData) {
    const stmt = this.db.prepare(`
      INSERT INTO ${this.table} (username, email, password_hash, role, first_name, last_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      userData.username,
      userData.email,
      userData.password_hash,
      userData.role,
      userData.first_name || null,
      userData.last_name || null
    );

    return this.findById(result.lastInsertRowid);
  }

  // Find user by ID
  findById(id) {
    const stmt = this.db.prepare(`
      SELECT id, username, email, role, first_name, last_name, is_active, created_at, updated_at
      FROM ${this.table}
      WHERE id = ? AND is_active = 1
    `);

    return stmt.get(id);
  }

  // Find user by username (for login) - case insensitive
  findByUsername(username) {
    const stmt = this.db.prepare(`
      SELECT id, username, email, password_hash, role, first_name, last_name, is_active
      FROM ${this.table}
      WHERE LOWER(username) = LOWER(?) AND is_active = 1
    `);

    return stmt.get(username);
  }

  // Find user by email
  findByEmail(email) {
    const stmt = this.db.prepare(`
      SELECT id, username, email, role, first_name, last_name, is_active, created_at, updated_at
      FROM ${this.table}
      WHERE email = ? AND is_active = 1
    `);

    return stmt.get(email);
  }

  // Get all users (admin only)
  findAll() {
    const stmt = this.db.prepare(`
      SELECT id, username, email, role, first_name, last_name, is_active, created_at, updated_at
      FROM ${this.table}
      ORDER BY created_at DESC
    `);

    return stmt.all();
  }

  // Update user
  update(id, userData) {
    const fields = [];
    const values = [];

    if (userData.username !== undefined) {
      fields.push('username = ?');
      values.push(userData.username);
    }
    if (userData.email !== undefined) {
      fields.push('email = ?');
      values.push(userData.email);
    }
    if (userData.password_hash !== undefined) {
      fields.push('password_hash = ?');
      values.push(userData.password_hash);
    }
    if (userData.role !== undefined) {
      fields.push('role = ?');
      values.push(userData.role);
    }
    if (userData.first_name !== undefined) {
      fields.push('first_name = ?');
      values.push(userData.first_name);
    }
    if (userData.last_name !== undefined) {
      fields.push('last_name = ?');
      values.push(userData.last_name);
    }
    if (userData.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(userData.is_active);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  // Soft delete user
  delete(id) {
    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    return stmt.run(id);
  }

  // Check if username exists
  usernameExists(username, excludeId = null) {
    let stmt;
    if (excludeId) {
      stmt = this.db.prepare('SELECT id FROM users WHERE username = ? AND id != ?');
      return !!stmt.get(username, excludeId);
    } else {
      stmt = this.db.prepare('SELECT id FROM users WHERE username = ?');
      return !!stmt.get(username);
    }
  }

  // Check if email exists
  emailExists(email, excludeId = null) {
    let stmt;
    if (excludeId) {
      stmt = this.db.prepare('SELECT id FROM users WHERE email = ? AND id != ?');
      return !!stmt.get(email, excludeId);
    } else {
      stmt = this.db.prepare('SELECT id FROM users WHERE email = ?');
      return !!stmt.get(email);
    }
  }
}

module.exports = new User();