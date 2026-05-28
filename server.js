require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// DB config
const db = require('./config/database');

// Swagger config
const { swaggerUi, specs } = require('./config/swagger');

// Error handler middleware
const errorHandler = require('./middleware/manejadorErrores');

// Routes
const usuariosRoutes = require('./routes/usuariosRoutes');
const autenticacionRoutes = require('./routes/autenticacionRoutes');
const transferenciasRoutes = require('./routes/transferenciasRoutes');
const bancosRoutes = require('./routes/bancosRoutes');
const clientesRoutes = require('./routes/clientesRoutes');
const cuentasRoutes = require('./routes/cuentasRoutes');
const transaccionesRoutes = require('./routes/transaccionesRoutes');
const movimientosRoutes = require('./routes/movimientosRoutes');
const finanzasRoutes = require('./routes/finanzasRoutes');

// App setup
const app = express();

// Middleware
app.set('trust proxy', 1);
app.use((req, res, next) => {
  const [path, query] = req.url.split('?');
  const normalizedPath = path.replace(/\/{2,}/g, '/');

  if (normalizedPath !== path) {
    req.url = normalizedPath + (query ? `?${query}` : '');
    req.originalUrl = req.url;
  }

  next();
});
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Swagger documentation
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(specs, {
  swaggerOptions: {
    persistAuthorization: true
  }
}));

// Routes
app.use('/api/auth', autenticacionRoutes);
app.use('/api/users', usuariosRoutes);
app.use('/api/transferencias', transferenciasRoutes);
app.use('/api/transferencia', transferenciasRoutes);
app.use('/api/bancos', bancosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/cuentas', cuentasRoutes);
app.use('/api/transacciones', transaccionesRoutes);
app.use('/api/movimientos', movimientosRoutes);
app.use('/api/finanzas', finanzasRoutes);

// Test endpoint - Bienvenida
app.get('/', (req, res) => {
  res.json({
    message: '¡Bienvenido al Sistema de Transferencias Bancarias!',
    version: '1.0.0',
    status: 'Servidor activo',
    timestamp: new Date().toISOString(),
    publicRoutes: {
      autenticacion: {
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        refresh: 'POST /api/auth/refresh-token'
      },
      transferencias: {
        config: 'GET /api/transferencias/config',
        catalogos: 'GET /api/transferencias/catalogos',
        validar: 'POST /api/transferencias/validar',
        interbancaria_entrante: 'POST /api/transferencias/interbancaria/entrante',
        notificacion_resultado: 'POST /api/transferencias/notificacion-resultado',
        validar_cuenta_destino: 'POST /api/transferencias/validar-cuenta-destino',
        validar_cuenta_externa: 'POST /api/transferencias/validar-cuenta-externa'
      },
      finanzas: {
        saldos: 'GET /api/finanzas/saldos',
        dashboard: 'GET /api/finanzas/dashboard',
        alertas: 'GET /api/finanzas/alertas'
      },
      bancos: {
        listar: 'GET /api/bancos',
        obtener: 'GET /api/bancos/:id'
      }
    },
    protectedRoutes: {
      users: 'GET /api/users (requiere autenticación)',
      transferencias_crear: 'POST /api/transferencias (requiere autenticación)',
      transacciones: 'GET /api/transacciones (requiere autenticación)',
      movimientos: 'GET /api/movimientos (requiere autenticación)',
      finanzas: 'GET /api/finanzas/* (requiere autenticación)'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

// Error handler middleware (debe ir al final)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`\nServidor ejecutándose en puerto ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'desarrollo'}`);
  console.log(`Base de datos: ${process.env.DB_NAME || 'bancoloscanchitos'}\n`);
});

module.exports = app;
