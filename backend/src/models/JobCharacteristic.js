const { getDatabase } = require('../utils/database');

class JobCharacteristic {
  constructor() {
    this.db = getDatabase();
    this.table = 'job_characteristics';
  }

  // Create a new job characteristic
  create(characteristicData) {
    const sqlParams = [
      characteristicData.order_id,
      characteristicData.type,
      characteristicData.value,
      characteristicData.color,
      characteristicData.display_name || characteristicData.value,
      characteristicData.is_system_generated ? 1 : 0
    ];

    const stmt = this.db.prepare(`
      INSERT INTO ${this.table} (
        order_id, type, value, color, display_name, is_system_generated
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(...sqlParams);
    return this.findById(result.lastInsertRowid);
  }

  // Find characteristic by ID
  findById(id) {
    return this.db.prepare(`
      SELECT * FROM ${this.table} WHERE id = ?
    `).get(id);
  }

  // Find all characteristics for an order
  findByOrderId(orderId) {
    return this.db.prepare(`
      SELECT * FROM ${this.table} 
      WHERE order_id = ?
      ORDER BY type, value
    `).all(orderId);
  }

  // Find all characteristics of a specific type
  findByType(type) {
    return this.db.prepare(`
      SELECT DISTINCT type, value, color, display_name
      FROM ${this.table} 
      WHERE type = ?
      ORDER BY value
    `).all(type);
  }

  // Get all available characteristic types with sample values
  getAvailableCharacteristics() {
    return this.db.prepare(`
      SELECT 
        type,
        COUNT(DISTINCT value) as value_count,
        GROUP_CONCAT(DISTINCT value) as sample_values,
        MIN(color) as sample_color
      FROM ${this.table}
      GROUP BY type
      ORDER BY type
    `).all();
  }

  // Detect and create characteristics for an order
  detectAndCreateCharacteristics(order) {
    const transaction = this.db.transaction(() => {
      const characteristics = this.detectCharacteristicsForOrder(order);
      const created = [];

      for (const char of characteristics) {
        const existingColors = this.getExistingColorAssignments();
        const colorAssignment = this.assignColor(char.type, char.value, existingColors);

        const created_char = this.create({
          order_id: order.id,
          type: char.type,
          value: char.value,
          display_name: char.display_name,
          color: colorAssignment,
          is_system_generated: char.is_system_generated
        });

        created.push(created_char);
      }

      return created;
    });

    return transaction();
  }

  // Detect characteristics for an order based on database-stored patterns
  detectCharacteristicsForOrder(order) {
    const CharacteristicTypes = require('./CharacteristicTypes');
    const characteristics = [];

    // Get all active characteristic types from database
    const activeTypes = CharacteristicTypes.getAll();

    // Create searchable text from order data
    const searchText = [
      order.order_number,
      order.stock_code,
      order.description,
      order.priority
    ].join(' ');

    // Detect characteristics using database patterns
    for (const type of activeTypes) {
      // Skip if no detection patterns defined
      if (!type.detection_patterns || type.detection_patterns.length === 0) {
        continue;
      }

      for (const pattern of type.detection_patterns) {
        try {
          const regex = new RegExp(pattern, 'gi');
          const matches = searchText.match(regex);

          if (matches) {
            for (const match of matches) {
              characteristics.push({
                type: type.type_key,
                value: match.toUpperCase(),
                display_name: `${type.name}: ${match.toUpperCase()}`,
                is_system_generated: true
              });
            }
            // Only take first match per type to avoid duplicates
            break;
          }
        } catch (e) {
          console.warn(`Invalid regex pattern for ${type.type_key}: ${pattern}`);
        }
      }
    }

    // Special handling for priority characteristic (doesn't need pattern matching)
    const priorityType = activeTypes.find(t => t.type_key === 'priority');
    if (priorityType && order.priority && order.priority !== 'medium') {
      // Check if we haven't already added a priority characteristic
      if (!characteristics.some(c => c.type === 'priority')) {
        characteristics.push({
          type: 'priority',
          value: order.priority,
          display_name: `${order.priority.charAt(0).toUpperCase()}${order.priority.slice(1)} Priority`,
          is_system_generated: true
        });
      }
    }

    // Special handling for part family (extract from stock code prefix)
    const partFamilyType = activeTypes.find(t => t.type_key === 'part_family');
    if (partFamilyType && order.stock_code) {
      const partFamilyMatch = order.stock_code.match(/^([A-Z]{2,4})/);
      if (partFamilyMatch && !characteristics.some(c => c.type === 'part_family')) {
        characteristics.push({
          type: 'part_family',
          value: partFamilyMatch[1],
          display_name: `${partFamilyMatch[1]} Family`,
          is_system_generated: true
        });
      }
    }

    // Remove any duplicate characteristics (same type and value)
    const uniqueCharacteristics = characteristics.filter((char, index, self) =>
      index === self.findIndex(c => c.type === char.type && c.value === char.value)
    );

    return uniqueCharacteristics;
  }

  // Get existing color assignments to maintain consistency
  getExistingColorAssignments() {
    const existing = this.db.prepare(`
      SELECT DISTINCT type, value, color
      FROM ${this.table}
    `).all();

    const assignments = new Map();
    for (const char of existing) {
      const key = `${char.type}_${char.value}`;
      assignments.set(key, char.color);
    }

    return assignments;
  }

  // Assign color to a characteristic
  assignColor(type, value, existingAssignments) {
    const key = `${type}_${value}`;

    // If we already have a color for this type+value, use it
    if (existingAssignments.has(key)) {
      return existingAssignments.get(key);
    }

    // Color palette for different characteristic types
    const colorPalettes = {
      customer_order: ['#3B82F6', '#1D4ED8', '#2563EB', '#1E40AF'],
      part_family: ['#10B981', '#059669', '#047857', '#065F46'],
      material: ['#F59E0B', '#D97706', '#B45309', '#92400E'],
      priority: ['#EF4444', '#DC2626', '#B91C1C', '#991B1B'],
      custom: ['#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6']
    };

    const palette = colorPalettes[type] || colorPalettes.custom;
    const usedColors = Array.from(existingAssignments.values());

    // Find first color in palette that's not used, or cycle through palette
    for (let i = 0; i < palette.length; i++) {
      if (!usedColors.includes(palette[i])) {
        return palette[i];
      }
    }

    // If all colors in palette are used, use index-based selection
    const index = existingAssignments.size % palette.length;
    return palette[index];
  }

  // Update a characteristic
  update(id, updateData) {
    const fields = [];
    const values = [];

    if (updateData.type !== undefined) {
      fields.push('type = ?');
      values.push(updateData.type);
    }
    if (updateData.value !== undefined) {
      fields.push('value = ?');
      values.push(updateData.value);
    }
    if (updateData.color !== undefined) {
      fields.push('color = ?');
      values.push(updateData.color);
    }
    if (updateData.display_name !== undefined) {
      fields.push('display_name = ?');
      values.push(updateData.display_name);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  // Delete a characteristic
  delete(id) {
    const stmt = this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`);
    return stmt.run(id);
  }

  // Delete all characteristics for an order
  deleteByOrderId(orderId) {
    const stmt = this.db.prepare(`DELETE FROM ${this.table} WHERE order_id = ?`);
    return stmt.run(orderId);
  }

  // Get characteristic statistics for analytics
  getCharacteristicStats() {
    return this.db.prepare(`
      SELECT 
        type,
        COUNT(*) as total_count,
        COUNT(DISTINCT value) as unique_values,
        COUNT(DISTINCT order_id) as orders_with_characteristic
      FROM ${this.table}
      GROUP BY type
      ORDER BY total_count DESC
    `).all();
  }

  // Get available characteristics from database types with usage statistics
  getAvailableCharacteristicsFromTypes() {
    const CharacteristicTypes = require('./CharacteristicTypes');

    // Get all characteristic types from database
    const types = CharacteristicTypes.getAll();

    // Add usage statistics for each type
    return types.map(type => {
      const usage = this.db.prepare(`
        SELECT 
          COUNT(DISTINCT value) as value_count,
          GROUP_CONCAT(DISTINCT value) as sample_values,
          color as sample_color
        FROM ${this.table}
        WHERE type = ?
        GROUP BY color
        LIMIT 1
      `).get(type.type_key);

      return {
        type: type.type_key,
        name: type.name,
        description: type.description,
        icon: type.icon,
        value_count: usage ? usage.value_count : 0,
        sample_values: usage ? usage.sample_values : '',
        sample_color: usage ? usage.sample_color : this.getDefaultColorForType(type.type_key),
        detection_patterns: type.detection_patterns,
        is_system_defined: type.is_system_defined
      };
    });
  }

  // Get default color for a characteristic type
  getDefaultColorForType(type) {
    const colorMap = {
      'customer_order': '#3B82F6', // Blue
      'customer': '#10B981',       // Green
      'material': '#F59E0B',       // Amber
      'priority': '#EF4444',       // Red
      'part_family': '#8B5CF6',    // Purple
      'custom': '#6B7280'          // Gray
    };
    return colorMap[type] || '#6B7280';
  }
}

module.exports = new JobCharacteristic();