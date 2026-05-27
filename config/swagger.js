const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Sistema de Transferencias Bancarias',
      version: '1.0.0',
      description: 'API REST para gestionar transferencias interbancarias, cuentas y movimientos',
      contact: {
        name: 'Banco Los Canches',
        email: 'soporte@loscanches.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Desarrollo'
      },
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'Producción'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        TransferenciaExterna: {
          type: 'object',
          required: ['cuenta_origen', 'cuenta_destino', 'swift_destino', 'monto'],
          properties: {
            cuenta_origen: {
              type: 'string',
              example: '1234567890',
              description: 'Número de cuenta del remitente'
            },
            cuenta_destino: {
              type: 'string',
              example: '9876543210',
              description: 'Número de cuenta del destinatario'
            },
            swift_destino: {
              type: 'string',
              example: 'CHBRCLMZ',
              description: 'Código SWIFT del banco destino'
            },
            monto: {
              type: 'number',
              example: 5000,
              description: 'Monto a transferir'
            },
            descripcion: {
              type: 'string',
              example: 'Pago a proveedor',
              description: 'Concepto de la transferencia'
            },
            tipo_transferencia: {
              type: 'string',
              example: 'EXTERNA',
              enum: ['INTERNA', 'EXTERNA']
            }
          }
        },
        TransferenciaEntrante: {
          type: 'object',
          required: ['TransactionID', 'cuentaOrigen', 'swiftOrigen', 'cuentaDestino', 'monto'],
          properties: {
            TransactionID: {
              type: 'string',
              example: 'CHBRCL2000-260526-XYZ98765',
              description: 'ID único de la transacción'
            },
            cuentaOrigen: {
              type: 'string',
              example: '1234567890',
              description: 'Número de cuenta origen'
            },
            swiftOrigen: {
              type: 'string',
              example: 'CHBRCLMZ',
              description: 'Código SWIFT del banco origen'
            },
            cuentaDestino: {
              type: 'string',
              example: '9876543210',
              description: 'Número de cuenta destino'
            },
            swiftDestino: {
              type: 'string',
              example: 'GTBC6968',
              description: 'Código SWIFT del banco destino (tu banco)'
            },
            NombreOrigen: {
              type: 'string',
              example: 'Juan Pérez García',
              description: 'Nombre del cliente origen'
            },
            monto: {
              type: 'number',
              example: 5000,
              description: 'Monto de la transferencia'
            },
            descripcion: {
              type: 'string',
              example: 'Pago de servicios',
              description: 'Concepto de la transferencia'
            }
          }
        },
        Respuesta: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            message: {
              type: 'string'
            },
            data: {
              type: 'object'
            }
          }
        }
      }
    }
  },
  apis: ['./routes/*.js']
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs
};
