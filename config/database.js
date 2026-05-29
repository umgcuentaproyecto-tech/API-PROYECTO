require('dotenv').config();
const mysql = require('mysql2/promise');

const DB_TIMEZONE = process.env.DB_TIMEZONE || '-06:00';

// Crear pool de conexiones a MySQL usando hora de Guatemala.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bancoloscanchitos',
  timezone: DB_TIMEZONE,
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.on('connection', (connection) => {
  connection.query(`SET time_zone = '${DB_TIMEZONE}'`, (error) => {
    if (error) {
      console.error('Error configurando zona horaria MySQL:', error.message);
    }
  });
});

// Probar conexion
pool.getConnection()
  .then(connection => {
    console.log(`Conexion a MySQL exitosa (zona horaria ${DB_TIMEZONE})`);
    connection.release();
  })
  .catch(error => {
    console.error('Error al conectar a MySQL:', error.message);
  });

module.exports = pool;
