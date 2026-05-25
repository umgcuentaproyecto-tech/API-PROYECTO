function getUserFromToken(token) {
  if (!token) {
    return null;
  }

  try {
    // Remover "Bearer " si existe
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    if (!cleanToken) {
      return null;
    }

    // Decodificar desde base64
    const decoded = Buffer.from(cleanToken, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error decodificando token:', error.message);
    return null;
  }
}

exports.requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const user = getUserFromToken(authHeader);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Sesion requerida'
    });
  }

  req.user = user;
  next();
};

// Middleware opcional de autenticación (no falla si no hay token)
exports.optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const user = getUserFromToken(authHeader);

  if (user) {
    req.user = user;
  }

  next();
};

exports.requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.rol)) {
    return res.status(403).json({
      success: false,
      message: 'No tiene permisos para acceder a este modulo'
    });
  }

  next();
};
