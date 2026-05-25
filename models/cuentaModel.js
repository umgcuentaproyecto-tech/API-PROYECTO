const pool = require('../config/database');
const crypto = require('crypto');

class Account {
  static async findAll() {
    const [rows] = await pool.query(
      `SELECT 
        c.id_cuenta,
        c.numero_cuenta,
        c.tipo_cuenta,
        c.moneda,
        c.saldo,
        c.swift_banco,
        c.estado,
        c.created_at,
        cl.id_cliente,
        CONCAT(cl.nombres, ' ', cl.apellidos) AS nombre_cliente,
        b.nombre AS banco_nombre
      FROM cuentas c
      INNER JOIN clientes cl ON cl.id_cliente = c.id_cliente
      INNER JOIN bancos b ON b.codigo_swift = c.swift_banco
      ORDER BY c.created_at DESC`
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query(
      `SELECT 
        c.id_cuenta,
        c.id_cliente,
        c.numero_cuenta,
        c.tipo_cuenta,
        c.moneda,
        c.saldo,
        c.swift_banco,
        c.estado,
        c.created_at,
        c.updated_at,
        CONCAT(cl.nombres, ' ', cl.apellidos) AS nombre_cliente,
        b.nombre AS banco_nombre
      FROM cuentas c
      INNER JOIN clientes cl ON cl.id_cliente = c.id_cliente
      INNER JOIN bancos b ON b.codigo_swift = c.swift_banco
      WHERE c.id_cuenta = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByAccountNumber(accountNumber) {
    const [rows] = await pool.query(
      'SELECT * FROM cuentas WHERE numero_cuenta = ?',
      [accountNumber]
    );
    return rows[0] || null;
  }

  static async create(data) {
    // Generar número de cuenta único
    const accountNumber = this.generateAccountNumber();
    
    // Validar que el cliente exista
    const [clientRows] = await pool.query(
      'SELECT id_cliente FROM clientes WHERE id_cliente = ?',
      [data.id_cliente]
    );
    
    if (clientRows.length === 0) {
      throw new Error('El cliente no existe');
    }

    // Validar que el banco exista
    const [bankRows] = await pool.query(
      'SELECT codigo_swift FROM bancos WHERE codigo_swift = ? AND activo = TRUE',
      [data.swift_banco]
    );

    if (bankRows.length === 0) {
      throw new Error('El banco no existe o no está activo');
    }

    const [result] = await pool.query(
      `INSERT INTO cuentas (id_cliente, numero_cuenta, tipo_cuenta, moneda, saldo, swift_banco, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id_cliente,
        accountNumber,
        data.tipo_cuenta || 'MONETARIA',
        data.moneda || 'GTQ',
        data.saldo || 0.00,
        data.swift_banco,
        data.estado || 'ACTIVA'
      ]
    );

    return this.findById(result.insertId);
  }

  static async update(id, data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const account = await this.findById(id);
      if (!account) {
        throw new Error('La cuenta no existe');
      }

      // Validar cambios de estado permitidos
      if (data.estado && data.estado !== account.estado) {
        const transitionAllowed = this.isStateTransitionAllowed(account.estado, data.estado);
        if (!transitionAllowed) {
          throw new Error(`No se puede cambiar de ${account.estado} a ${data.estado}`);
        }
      }

      await connection.query(
        `UPDATE cuentas 
         SET tipo_cuenta = ?, moneda = ?, estado = ?
         WHERE id_cuenta = ?`,
        [
          data.tipo_cuenta || account.tipo_cuenta,
          data.moneda || account.moneda,
          data.estado || account.estado,
          id
        ]
      );

      await connection.commit();
      return this.findById(id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getAccountsByClient(clientId) {
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

  static async updateBalance(accountNumber, amount, increment = true) {
    const [result] = await pool.query(
      increment
        ? 'UPDATE cuentas SET saldo = saldo + ? WHERE numero_cuenta = ?'
        : 'UPDATE cuentas SET saldo = saldo - ? WHERE numero_cuenta = ?',
      [amount, accountNumber]
    );
    return result.affectedRows > 0;
  }

  static generateAccountNumber() {
    // Generar número de cuenta de 12 dígitos: AAMMNNNNNNNN
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = crypto.randomBytes(4).toString('hex').substring(0, 6);
    return year + month + random;
  }

  static isStateTransitionAllowed(currentState, newState) {
    const allowedTransitions = {
      'ACTIVA': ['INACTIVA', 'BLOQUEADA', 'CERRADA'],
      'INACTIVA': ['ACTIVA', 'CERRADA'],
      'BLOQUEADA': ['ACTIVA', 'CERRADA'],
      'CERRADA': [] // No se puede cambiar estado desde CERRADA
    };

    return allowedTransitions[currentState]?.includes(newState) || false;
  }

  static async closeAccount(id) {
    const account = await this.findById(id);
    if (!account) {
      throw new Error('La cuenta no existe');
    }

    if (account.saldo > 0) {
      throw new Error('No se puede cerrar una cuenta con saldo pendiente');
    }

    return this.update(id, { estado: 'CERRADA' });
  }

  static async delete(id) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const account = await this.findById(id);
      if (!account) {
        throw new Error('La cuenta no existe');
      }

      // Eliminar transacciones de la cuenta
      await connection.query(
        'DELETE FROM transacciones WHERE id_cuenta = ?',
        [id]
      );

      // Eliminar movimientos de la cuenta
      await connection.query(
        'DELETE FROM movimientos WHERE id_cuenta = ?',
        [id]
      );

      // Eliminar la cuenta
      await connection.query(
        'DELETE FROM cuentas WHERE id_cuenta = ?',
        [id]
      );

      await connection.commit();
      return { success: true, message: 'Cuenta eliminada completamente' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = Account;
