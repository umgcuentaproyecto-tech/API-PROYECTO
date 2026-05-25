// Middleware para manejo de errores

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  const status = err.status || 500;
  const message = err.message || 'Error interno del servidor';

  res.status(status).json({
    success: false,
    status,
    message,
    ...(process.env.NODE_ENV === 'desarrollo' && { stack: err.stack })
  });
};

module.exports = errorHandler;
