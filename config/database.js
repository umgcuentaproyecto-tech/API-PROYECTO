require('dotenv').config();
const mysql = require('mysql2/promise');

// Crear pool de conexiones a MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bancoloscanchitos',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Probar conexión
pool.getConnection()
  .then(connection => {
    console.log('Conexión a MySQL exitosa');
    connection.release();
  })
  .catch(error => {
    console.error('Error al conectar a MySQL:', error.message);
  });

module.exports = pool;
