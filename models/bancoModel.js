const pool = require('../config/database');

class Bank {
  static async findAll() {
    const [rows] = await pool.query(
      `SELECT id_banco, nombre, codigo_swift, url_api, endpoint_transferencia, activo, created_at, updated_at
       FROM bancos
       ORDER BY created_at DESC`
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query(
      `SELECT id_banco, nombre, codigo_swift, url_api, endpoint_transferencia, activo, created_at, updated_at
       FROM bancos
       WHERE id_banco = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findBySwift(codigo_swift) {
    const [rows] = await pool.query(
      `SELECT id_banco, nombre, codigo_swift, url_api, endpoint_transferencia, activo, created_at, updated_at
       FROM bancos
       WHERE codigo_swift = ?`,
      [codigo_swift]
    );
    return rows[0] || null;
  }

  static async create(data) {
    if (!data.nombre || !data.codigo_swift || !data.url_api) {
      throw new Error('Nombre, código SWIFT y URL API son requeridos');
    }

    try {
      const [result] = await pool.query(
        `INSERT INTO bancos (nombre, codigo_swift, url_api, endpoint_transferencia, activo)
         VALUES (?, ?, ?, ?, ?)`,
        [
          data.nombre,
          data.codigo_swift,
          data.url_api,
          data.endpoint_transferencia || '/api/transferencias/interbancaria/entrante',
          data.activo ?? true
        ]
      );

      return this.findById(result.insertId);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('El código SWIFT ya existe');
      }
      throw error;
    }
  }

  static async update(id, data) {
    const bank = await this.findById(id);
    if (!bank) {
      throw new Error('Banco no encontrado');
    }

    const fields = [];
    const values = [];

    if (data.nombre !== undefined) {
      fields.push('nombre = ?');
      values.push(data.nombre);
    }
    if (data.codigo_swift !== undefined) {
      fields.push('codigo_swift = ?');
      values.push(data.codigo_swift);
    }
    if (data.url_api !== undefined) {
      fields.push('url_api = ?');
      values.push(data.url_api);
    }
    if (data.endpoint_transferencia !== undefined) {
      fields.push('endpoint_transferencia = ?');
      values.push(data.endpoint_transferencia);
    }
    if (data.activo !== undefined) {
      fields.push('activo = ?');
      values.push(data.activo);
    }

    if (fields.length === 0) {
      return bank;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    try {
      await pool.query(
        `UPDATE bancos SET ${fields.join(', ')} WHERE id_banco = ?`,
        values
      );
      return this.findById(id);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('El código SWIFT ya existe');
      }
      throw error;
    }
  }

  static async delete(id) {
    const bank = await this.findById(id);
    if (!bank) {
      throw new Error('Banco no encontrado');
    }

    // Verificar si el banco tiene transferencias asociadas
    const [transfers] = await pool.query(
      `SELECT COUNT(*) as count FROM transferencias 
       WHERE swift_origen = ? OR swift_destino = ?`,
      [bank.codigo_swift, bank.codigo_swift]
    );

    if (transfers[0].count > 0) {
      throw new Error('No se puede eliminar el banco porque tiene transferencias asociadas');
    }

    // Verificar si el banco tiene cuentas asociadas
    const [accounts] = await pool.query(
      `SELECT COUNT(*) as count FROM cuentas 
       WHERE swift_banco = ?`,
      [bank.codigo_swift]
    );

    if (accounts[0].count > 0) {
      throw new Error('No se puede eliminar el banco porque tiene cuentas asociadas');
    }

    await pool.query('DELETE FROM bancos WHERE id_banco = ?', [id]);
    return { success: true };
  }

  static async toggleActive(id, activo) {
    const bank = await this.findById(id);
    if (!bank) {
      throw new Error('Banco no encontrado');
    }

    await pool.query(
      `UPDATE bancos SET activo = ?, updated_at = CURRENT_TIMESTAMP WHERE id_banco = ?`,
      [activo, id]
    );

    return this.findById(id);
  }
}

module.exports = Bank;
