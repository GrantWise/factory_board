const { getDatabase } = require('../utils/database');

class WorkCentre {
  constructor() {
    this.db = getDatabase();
    this.table = 'work_centres';
  }

  // Create a new work centre
  create(workCentreData) {
    const stmt = this.db.prepare(`
      INSERT INTO ${this.table} (name, code, description, capacity, display_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      workCentreData.name,
      workCentreData.code,
      workCentreData.description || null,
      workCentreData.capacity || 1,
      workCentreData.display_order || 0,
      workCentreData.is_active !== undefined ? workCentreData.is_active : 1
    );
    
    return this.findById(result.lastInsertRowid);
  }

  // Find work centre by ID with machines
  findById(id) {
    const workCentre = this.db.prepare(`
      SELECT * FROM ${this.table} WHERE id = ?
    `).get(id);
    
    if (!workCentre) return null;
    
    // Get associated machines
    workCentre.machines = this.db.prepare(`
      SELECT id, name, code, description, is_active
      FROM machines 
      WHERE work_centre_id = ? AND is_active = 1
      ORDER BY name
    `).all(id);
    
    return workCentre;
  }

  // Find work centre by code
  findByCode(code) {
    const workCentre = this.db.prepare(`
      SELECT * FROM ${this.table} WHERE code = ?
    `).get(code);
    
    if (!workCentre) return null;
    
    // Get associated machines
    workCentre.machines = this.db.prepare(`
      SELECT id, name, code, description, is_active
      FROM machines 
      WHERE work_centre_id = ? AND is_active = 1
      ORDER BY name
    `).all(workCentre.id);
    
    return workCentre;
  }

  // Get all work centres with machines and current job counts
  findAll(includeInactive = false) {
    const whereClause = includeInactive ? '' : 'WHERE wc.is_active = 1';
    
    const workCentres = this.db.prepare(`
      SELECT wc.*,
             COUNT(mo.id) as current_jobs
      FROM ${this.table} wc
      LEFT JOIN manufacturing_orders mo ON mo.current_work_centre_id = wc.id 
        AND mo.status IN ('not_started', 'in_progress')
      ${whereClause}
      GROUP BY wc.id
      ORDER BY wc.display_order, wc.name
    `).all();
    
    // Get machines for each work centre
    for (const workCentre of workCentres) {
      workCentre.machines = this.db.prepare(`
        SELECT id, name, code, description, is_active
        FROM machines 
        WHERE work_centre_id = ? AND is_active = 1
        ORDER BY name
      `).all(workCentre.id);
    }
    
    return workCentres;
  }

  // Update work centre
  update(id, workCentreData) {
    const fields = [];
    const values = [];
    
    if (workCentreData.name !== undefined) {
      fields.push('name = ?');
      values.push(workCentreData.name);
    }
    if (workCentreData.code !== undefined) {
      fields.push('code = ?');
      values.push(workCentreData.code);
    }
    if (workCentreData.description !== undefined) {
      fields.push('description = ?');
      values.push(workCentreData.description);
    }
    if (workCentreData.capacity !== undefined) {
      fields.push('capacity = ?');
      values.push(workCentreData.capacity);
    }
    if (workCentreData.display_order !== undefined) {
      fields.push('display_order = ?');
      values.push(workCentreData.display_order);
    }
    if (workCentreData.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(workCentreData.is_active);
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

  // Delete work centre (soft delete)
  delete(id) {
    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    return stmt.run(id);
  }

  // Reorder work centres
  updateDisplayOrder(orderUpdates) {
    const stmt = this.db.prepare(`
      UPDATE ${this.table}
      SET display_order = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const transaction = this.db.transaction(() => {
      for (const update of orderUpdates) {
        stmt.run(update.display_order, update.id);
      }
    });
    
    transaction();
  }

  // Check if code exists
  codeExists(code, excludeId = null) {
    let stmt;
    if (excludeId) {
      stmt = this.db.prepare('SELECT id FROM work_centres WHERE code = ? AND id != ?');
      return !!stmt.get(code, excludeId);
    } else {
      stmt = this.db.prepare('SELECT id FROM work_centres WHERE code = ?');
      return !!stmt.get(code);
    }
  }

  // Add machine to work centre
  addMachine(workCentreId, machineData) {
    const stmt = this.db.prepare(`
      INSERT INTO machines (name, code, work_centre_id, description, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      machineData.name,
      machineData.code,
      workCentreId,
      machineData.description || null,
      machineData.is_active !== undefined ? machineData.is_active : 1
    );
    
    return this.db.prepare('SELECT * FROM machines WHERE id = ?').get(result.lastInsertRowid);
  }

  // Update machine
  updateMachine(machineId, machineData) {
    const fields = [];
    const values = [];
    
    if (machineData.name !== undefined) {
      fields.push('name = ?');
      values.push(machineData.name);
    }
    if (machineData.code !== undefined) {
      fields.push('code = ?');
      values.push(machineData.code);
    }
    if (machineData.description !== undefined) {
      fields.push('description = ?');
      values.push(machineData.description);
    }
    if (machineData.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(machineData.is_active);
    }
    
    if (fields.length === 0) {
      return this.db.prepare('SELECT * FROM machines WHERE id = ?').get(machineId);
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(machineId);
    
    const stmt = this.db.prepare(`
      UPDATE machines
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    
    stmt.run(...values);
    return this.db.prepare('SELECT * FROM machines WHERE id = ?').get(machineId);
  }

  // Delete machine
  deleteMachine(machineId) {
    const stmt = this.db.prepare(`
      UPDATE machines
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    return stmt.run(machineId);
  }
}

module.exports = new WorkCentre();