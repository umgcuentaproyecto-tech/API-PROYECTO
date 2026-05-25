const pool = require('../config/database');
const bcrypt = require('bcryptjs');

const ALLOWED_ROLES = ['NUEVO_USUARIO', 'ADMIN', 'OPERADOR', 'FINANZAS', 'AUDITOR'];

class User {
  static async findAll() {
    const [rows] = await pool.query(
      `SELECT id_usuario, nombre, email, rol, activo, created_at, updated_at
       FROM usuarios
       ORDER BY created_at DESC`
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query(
      `SELECT id_usuario, nombre, email, rol, activo, created_at, updated_at
       FROM usuarios
       WHERE id_usuario = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByEmail(email) {
    const [rows] = await pool.query(
      `SELECT id_usuario, nombre, email, password_hash, rol, activo
       FROM usuarios
       WHERE email = ?`,
      [email]
    );
    return rows[0] || null;
  }

  static async create(data) {
    const role = ALLOWED_ROLES.includes(data.rol) ? data.rol : 'NUEVO_USUARIO';
    let passwordHash = data.password_hash || 'nuevo';

    // Hashear la contraseña
    if (data.password_hash) {
      passwordHash = await bcrypt.hash(data.password_hash, 10);
    } else {
      // Si no hay contraseña, hashear el valor por defecto
      passwordHash = await bcrypt.hash(passwordHash, 10);
    }

    const [result] = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
       VALUES (?, ?, ?, ?, ?)`,
      [data.nombre, data.email, passwordHash, role, data.activo ?? true]
    );

    return this.findById(result.insertId);
  }

  static async update(id, data) {
    const fields = [];
    const values = [];

    if (data.nombre !== undefined) {
      fields.push('nombre = ?');
      values.push(data.nombre);
    }
    if (data.email !== undefined) {
      fields.push('email = ?');
      values.push(data.email);
    }
    if (data.rol !== undefined && ALLOWED_ROLES.includes(data.rol)) {
      fields.push('rol = ?');
      values.push(data.rol);
    }
    if (data.activo !== undefined) {
      fields.push('activo = ?');
      values.push(Boolean(data.activo));
    }
    if (data.password_hash !== undefined) {
      // Hashear la contraseña antes de guardarla
      const hashedPassword = await bcrypt.hash(data.password_hash, 10);
      fields.push('password_hash = ?');
      values.push(hashedPassword);
    }

    if (fields.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    values.push(id);
    const [result] = await pool.query(
      `UPDATE usuarios SET ${fields.join(', ')} WHERE id_usuario = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(id);
  }

  static async delete(id) {
    const user = await this.findById(id);
    if (!user) {
      return null;
    }

    await pool.query('DELETE FROM usuarios WHERE id_usuario = ?', [id]);
    return user;
  }
}

module.exports = User;
