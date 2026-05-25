require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// DB config
const db = require('./config/database');

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

// App setup
const app = express();

// Middleware
app.set('trust proxy', 1);
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// Test endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Bienvenido a la API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/login',
      users: '/api/users',
      transferencias: '/api/transferencias',
      validarTransferencia: '/api/transferencias/validar'
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
