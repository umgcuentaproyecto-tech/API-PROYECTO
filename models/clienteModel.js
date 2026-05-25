const pool = require('../config/database');

class Client {
  static async findAll() {
    const [rows] = await pool.query(
      `SELECT 
        id_cliente,
        nombres,
        apellidos,
        dpi,
        nit,
        telefono,
        email,
        direccion,
        estado,
        created_at,
        updated_at
      FROM clientes
      ORDER BY nombres ASC`
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query(
      `SELECT 
        id_cliente,
        nombres,
        apellidos,
        dpi,
        nit,
        telefono,
        email,
        direccion,
        estado,
        created_at,
        updated_at
      FROM clientes
      WHERE id_cliente = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByDPI(dpi) {
    const [rows] = await pool.query(
      'SELECT * FROM clientes WHERE dpi = ?',
      [dpi]
    );
    return rows[0] || null;
  }

  static async create(data) {
    // Validar DPI único
    const existingClient = await this.findByDPI(data.dpi);
    if (existingClient) {
      throw new Error('El DPI ya está registrado en el sistema');
    }

    const [result] = await pool.query(
      `INSERT INTO clientes (nombres, apellidos, dpi, nit, telefono, email, direccion, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.nombres,
        data.apellidos,
        data.dpi,
        data.nit || null,
        data.telefono || null,
        data.email || null,
        data.direccion || null,
        data.estado || 'ACTIVO'
      ]
    );

    return this.findById(result.insertId);
  }

  static async update(id, data) {
    // Si se actualiza DPI, validar que sea único
    if (data.dpi) {
      const client = await this.findById(id);
      if (client.dpi !== data.dpi) {
        const existingClient = await this.findByDPI(data.dpi);
        if (existingClient) {
          throw new Error('El DPI ya está registrado en el sistema');
        }
      }
    }

    await pool.query(
      `UPDATE clientes 
       SET nombres = ?, apellidos = ?, dpi = ?, nit = ?, telefono = ?, email = ?, direccion = ?, estado = ?
       WHERE id_cliente = ?`,
      [
        data.nombres || undefined,
        data.apellidos || undefined,
        data.dpi || undefined,
        data.nit || null,
        data.telefono || null,
        data.email || null,
        data.direccion || null,
        data.estado || undefined,
        id
      ]
    );

    return this.findById(id);
  }

  static async getClientAccounts(clientId) {
    const [rows] = await pool.query(
      `SELECT 
        id_cuenta,
        numero_cuenta,
        tipo_cuenta,
        moneda,
        saldo,
        swift_banco,
        estado,
        created_at
      FROM cuentas
      WHERE id_cliente = ?
      ORDER BY created_at DESC`,
      [clientId]
    );
    return rows;
  }

  static async delete(id) {
    // Validar que el cliente no tenga cuentas activas
    const accounts = await this.getClientAccounts(id);
    const activeAccounts = accounts.filter(a => a.estado !== 'CERRADA');
    
    if (activeAccounts.length > 0) {
      throw new Error('No se puede eliminar un cliente que tiene cuentas activas');
    }

    await pool.query('DELETE FROM clientes WHERE id_cliente = ?', [id]);
    return true;
  }

  static async deactivate(id) {
    // Desactivar todas las cuentas del cliente
    const accounts = await this.getClientAccounts(id);
    
    if (accounts.length === 0) {
      throw new Error('El cliente no tiene cuentas asociadas');
    }

    // Marcar todas las cuentas como INACTIVAS
    await pool.query(
      'UPDATE cuentas SET estado = "INACTIVA" WHERE id_cliente = ? AND estado != "INACTIVA"',
      [id]
    );

    // Marcar el cliente como INACTIVO
    await pool.query(
      'UPDATE clientes SET estado = "INACTIVO" WHERE id_cliente = ?',
      [id]
    );

    return this.findById(id);
  }
}

module.exports = Client;
