const User = require('../models/usuarioModel');
const bcrypt = require('bcryptjs');
const AuditService = require('../utils/auditService');

function createSessionToken(user) {
  const payload = {
    id_usuario: user.id_usuario,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    issued_at: new Date().toISOString()
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

exports.login = async (req, res) => {
  try {
    const { usuario, contrasena } = req.body;

    if (!usuario || !contrasena) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y contrasena son requeridos'
      });
    }

    const user = await User.findByEmail(usuario);

    if (!user || !user.activo) {
      await AuditService.login(user, false, {
        usuario,
        motivo: user ? 'USUARIO_INACTIVO' : 'USUARIO_NO_EXISTE'
      }, req);

      return res.status(401).json({
        success: false,
        message: 'Credenciales invalidas'
      });
    }

    // Comparar contraseña hasheada
    const passwordMatch = await bcrypt.compare(contrasena, user.password_hash);
    
    if (!passwordMatch) {
      await AuditService.login(user, false, {
        usuario,
        motivo: 'PASSWORD_INVALIDO'
      }, req);

      return res.status(401).json({
        success: false,
        message: 'Credenciales invalidas'
      });
    }

    const sessionUser = {
      id_usuario: user.id_usuario,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      activo: user.activo
    };

    await AuditService.login(sessionUser, true, {
      usuario,
      rol: sessionUser.rol
    }, req);

    res.json({
      success: true,
      message: 'Inicio de sesion exitoso',
      token: createSessionToken(sessionUser),
      user: sessionUser
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesion',
      error: error.message
    });
  }
};
