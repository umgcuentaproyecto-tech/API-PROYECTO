const User = require('../models/usuarioModel');
const AuditService = require('../utils/auditService');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios',
      error: error.message
    });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuario',
      error: error.message
    });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { nombre, email, password_hash, rol, activo } = req.body;

    if (!nombre || !email) {
      return res.status(400).json({
        success: false,
        message: 'El nombre y email son requeridos'
      });
    }

    const user = await User.create({ nombre, email, password_hash, rol, activo });

    // Auditoría
    await AuditService.crear('usuarios', user.id_usuario, {
      nombre: user.nombre,
      email: user.email,
      rol: user.rol
    }, req.user);

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario',
      error: error.message
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.update(req.params.id, req.body);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Auditoría
    await AuditService.actualizar('usuarios', req.params.id, {
      nombre: user.nombre,
      email: user.email,
      rol: user.rol
    }, req.user);

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario',
      error: error.message
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.delete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Auditoría
    await AuditService.eliminar('usuarios', req.params.id, {
      nombre: user.nombre,
      email: user.email
    }, req.user);

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario',
      error: error.message
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña es requerida'
      });
    }

    const user = await User.update(req.params.id, { password_hash: password });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al cambiar contraseña',
      error: error.message
    });
  }
};
