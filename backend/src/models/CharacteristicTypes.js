const { getDatabase } = require('../utils/database');

class CharacteristicTypes {
  constructor() {
    this.db = getDatabase();
    this.table = 'characteristic_types';
  }

  // Get all active characteristic types for UI
  getAll(includeInactive = false) {
    const whereClause = includeInactive ? '' : 'WHERE is_active = 1';
    return this.db.prepare(`
      SELECT * FROM ${this.table}
      ${whereClause}
      ORDER BY sort_order, name
    `).all().map(this.parseDetectionPatterns);
  }

  // Get a specific characteristic type by key
  getByKey(typeKey) {
    const type = this.db.prepare(`
      SELECT * FROM ${this.table}
      WHERE type_key = ? AND is_active = 1
    `).get(typeKey);

    return type ? this.parseDetectionPatterns(type) : null;
  }

  // Get enabled characteristic types for a user (from user settings)
  getEnabledForUser(userId) {
    // This would integrate with user settings
    // For now, return all active types
    return this.getAll();
  }

  // Parse detection patterns from JSON string
  parseDetectionPatterns(type) {
    try {
      type.detection_patterns = type.detection_patterns ? JSON.parse(type.detection_patterns) : [];
    } catch (e) {
      type.detection_patterns = [];
    }
    return type;
  }

  // Create a new characteristic type (admin function)
  create(typeData) {
    const {
      type_key,
      name,
      description,
      detection_patterns = [],
      icon = 'Tag',
      is_system_defined = false,
      sort_order = 999
    } = typeData;

    // Validate required fields
    if (!type_key || !name) {
      throw new Error('type_key and name are required');
    }

    // Check if type_key already exists
    const existing = this.db.prepare(`
      SELECT id FROM ${this.table} WHERE type_key = ?
    `).get(type_key);

    if (existing) {
      throw new Error(`Characteristic type '${type_key}' already exists`);
    }

    const stmt = this.db.prepare(`
      INSERT INTO ${this.table} (
        type_key, name, description, detection_patterns, icon, 
        is_system_defined, sort_order, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const result = stmt.run(
      type_key,
      name,
      description,
      JSON.stringify(detection_patterns),
      icon,
      is_system_defined,
      sort_order
    );

    return this.getById(result.lastInsertRowid);
  }

  // Update an existing characteristic type
  update(id, updateData) {
    const fields = [];
    const values = [];

    const allowedFields = [
      'name', 'description', 'detection_patterns', 'icon',
      'is_active', 'sort_order'
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'detection_patterns') {
          fields.push(`${field} = ?`);
          values.push(JSON.stringify(updateData[field]));
        } else {
          fields.push(`${field} = ?`);
          values.push(updateData[field]);
        }
      }
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.getById(id);
  }

  // Get by ID
  getById(id) {
    const type = this.db.prepare(`
      SELECT * FROM ${this.table} WHERE id = ?
    `).get(id);

    return type ? this.parseDetectionPatterns(type) : null;
  }

  // Delete a characteristic type (soft delete by setting is_active = 0)
  delete(id) {
    // Don't allow deletion of system-defined types
    const type = this.getById(id);
    if (!type) {
      throw new Error('Characteristic type not found');
    }

    if (type.is_system_defined) {
      throw new Error('Cannot delete system-defined characteristic types');
    }

    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    return stmt.run(id);
  }

  // Get usage statistics for each characteristic type
  getUsageStats() {
    return this.db.prepare(`
      SELECT 
        ct.type_key,
        ct.name,
        COUNT(jc.id) as usage_count,
        COUNT(DISTINCT jc.value) as unique_values,
        COUNT(DISTINCT jc.order_id) as orders_with_characteristic
      FROM ${this.table} ct
      LEFT JOIN job_characteristics jc ON ct.type_key = jc.type
      WHERE ct.is_active = 1
      GROUP BY ct.id, ct.type_key, ct.name
      ORDER BY ct.sort_order
    `).all();
  }

  // Get available values for a specific characteristic type
  getValuesForType(typeKey, limit = 20) {
    return this.db.prepare(`
      SELECT 
        value,
        color,
        display_name,
        COUNT(*) as usage_count
      FROM job_characteristics
      WHERE type = ?
      GROUP BY value, color, display_name
      ORDER BY usage_count DESC, value
      LIMIT ?
    `).all(typeKey, limit);
  }

  // Auto-detect characteristics in text using detection patterns
  detectInText(text, typeKey = null) {
    const types = typeKey ? [this.getByKey(typeKey)] : this.getAll();
    const detected = [];

    for (const type of types) {
      if (!type || !type.detection_patterns || type.detection_patterns.length === 0) {
        continue;
      }

      for (const pattern of type.detection_patterns) {
        try {
          const regex = new RegExp(pattern, 'gi');
          const matches = text.match(regex);

          if (matches) {
            for (const match of matches) {
              detected.push({
                type_key: type.type_key,
                type_name: type.name,
                value: match.toUpperCase(),
                display_name: `${type.name}: ${match.toUpperCase()}`,
                confidence: 0.9, // High confidence for pattern matches
                source: 'pattern_detection'
              });
            }
          }
        } catch (e) {
          console.warn(`Invalid regex pattern for ${type.type_key}: ${pattern}`);
        }
      }
    }

    // Remove duplicates
    const unique = detected.filter((item, index, self) =>
      index === self.findIndex(t => t.type_key === item.type_key && t.value === item.value)
    );

    return unique;
  }
}

module.exports = new CharacteristicTypes();