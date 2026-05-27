const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferenciaController');
const { requireAuth, requireRole, optionalAuth } = require('../middleware/middlewareAutenticacion');

/**
 * @swagger
 * /api/transferencias/config:
 *   get:
 *     summary: Obtener configuración del banco
 *     tags: [Configuración]
 *     responses:
 *       200:
 *         description: Configuración obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     local_swift:
 *                       type: string
 *                       example: "GTBC6968"
 */
router.get('/config', transferController.getConfig);

/**
 * @swagger
 * /api/transferencias/catalogos:
 *   get:
 *     summary: Obtener catálogos de transferencias
 *     tags: [Catálogos]
 *     responses:
 *       200:
 *         description: Catálogos obtenidos exitosamente
 */
router.get('/catalogos', transferController.getCatalogs);

/**
 * @swagger
 * /api/transferencias/validar:
 *   post:
 *     summary: Validar una transferencia interbancaria
 *     tags: [Validación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransferenciaEntrante'
 *     responses:
 *       200:
 *         description: Transferencia validada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [APROBADO, RECHAZADO]
 *                 TransactionID:
 *                   type: string
 *       400:
 *         description: Error en validación
 */
router.post('/validar', transferController.validateTransfer);

/**
 * @swagger
 * /api/transferencias/interbancaria/entrante:
 *   post:
 *     summary: Recibir transferencia interbancaria de otro banco
 *     tags: [Transferencias Entrantes]
 *     description: Endpoint para que otros bancos envíen transferencias a este banco
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransferenciaEntrante'
 *           example:
 *             TransactionID: "CHBRCL2000-260526-XYZ98765"
 *             cuentaOrigen: "1234567890"
 *             swiftOrigen: "CHBRCLMZ"
 *             cuentaDestino: "9876543210"
 *             swiftDestino: "GTBC6968"
 *             NombreOrigen: "Juan Pérez García"
 *             monto: 5000
 *             descripcion: "Pago de servicios"
 *     responses:
 *       200:
 *         description: Transferencia recibida y aprobada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: string
 *                   example: "APROBADO"
 *                 TransactionID:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Transferencia rechazada
 */
router.post('/interbancaria/entrante', transferController.receiveIncomingTransfer);

/**
 * @swagger
 * /api/transferencias:
 *   post:
 *     summary: Crear una nueva transferencia
 *     tags: [Transferencias]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransferenciaExterna'
 *           example:
 *             cuenta_origen: "1234567890"
 *             cuenta_destino: "9876543210"
 *             swift_destino: "CHBRCLMZ"
 *             monto: 5000
 *             descripcion: "Pago a proveedor externo"
 *     responses:
 *       201:
 *         description: Transferencia creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Error al crear transferencia
 *       401:
 *         description: No autorizado
 */
router.post('/', optionalAuth, transferController.createTransfer);

/**
 * @swagger
 * /api/transferencias/notificacion-resultado:
 *   post:
 *     summary: Recibir notificación de resultado de transferencia
 *     tags: [Notificaciones]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [transaction_id, estado]
 *             properties:
 *               transaction_id:
 *                 type: string
 *               estado:
 *                 type: string
 *                 enum: [APROBADA, RECHAZADA]
 *               mensaje:
 *                 type: string
 *     responses:
 *       200:
 *         description: Notificación procesada
 */
router.post('/notificacion-resultado', transferController.receiveNotification);

/**
 * @swagger
 * /api/transferencias/validar-cuenta-destino:
 *   post:
 *     summary: Validar cuenta destino local
 *     tags: [Validación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               numero_cuenta:
 *                 type: string
 *               banco:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cuenta validada
 */
router.post('/validar-cuenta-destino', transferController.validateDestinationAccount);

/**
 * @swagger
 * /api/transferencias/validar-cuenta-externa:
 *   post:
 *     summary: Validar cuenta en banco externo
 *     tags: [Validación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [numeroCuenta, codigoSwift]
 *             properties:
 *               numeroCuenta:
 *                 type: string
 *               codigoSwift:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cuenta validada
 */
router.post('/validar-cuenta-externa', transferController.validateAccountAtBank);

/**
 * @swagger
 * /api/transferencias:
 *   get:
 *     summary: Listar todas las transferencias
 *     tags: [Transferencias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *         description: Filtrar por estado
 *     responses:
 *       200:
 *         description: Lista de transferencias obtenida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                 count:
 *                   type: integer
 *       401:
 *         description: No autorizado
 */
router.get('/', requireAuth, requireRole('ADMIN', 'OPERADOR'), transferController.getAllTransfers);

module.exports = router;
