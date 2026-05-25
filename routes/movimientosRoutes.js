const express = require('express');
const router = express.Router();
const movementController = require('../controllers/movimientoController');
const authMiddleware = require('../middleware/middlewareAutenticacion');

// Todos los movimientos
router.get('/', authMiddleware.requireAuth, movementController.getAllMovements);

// Movimientos de una cuenta
router.get('/account/:accountId', authMiddleware.requireAuth, movementController.getMovementsByAccount);

// Estado de cuenta
router.get('/account/:accountId/statement', authMiddleware.requireAuth, movementController.getAccountStatement);

// Resumen de movimientos
router.get('/account/:accountId/summary', authMiddleware.requireAuth, movementController.getMovementsSummary);

// Movimientos de un cliente
router.get('/client/:clientId', authMiddleware.requireAuth, movementController.getMovementsByClient);

// Detalle de un movimiento
router.get('/:movementId', authMiddleware.requireAuth, movementController.getMovementById);

module.exports = router;
