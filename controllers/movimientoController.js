const Movement = require('../models/movimientoModel');
const Account = require('../models/cuentaModel');
const Client = require('../models/clienteModel');

// Todos los movimientos
exports.getAllMovements = async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;

    try {
        const movements = await Movement.findAll(limit);
        return res.status(200).json({
            success: true,
            count: movements.length,
            data: movements
        });
    } catch (error) {
        console.error('Error al obtener movimientos:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener movimientos',
            error: error.message
        });
    }
};

// Movimientos de una cuenta
exports.getMovementsByAccount = async (req, res) => {
    const { accountId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;

    if (!accountId) {
        return res.status(400).json({
            success: false,
            message: 'ID de cuenta requerido'
        });
    }

    try {
        const movements = await Movement.findByAccount(accountId, limit);
        
        if (movements.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No hay movimientos registrados para esta cuenta',
                count: 0,
                data: []
            });
        }

        return res.status(200).json({
            success: true,
            count: movements.length,
            data: movements
        });
    } catch (error) {
        console.error('Error al obtener movimientos:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener movimientos',
            error: error.message
        });
    }
};

// Movimientos de un cliente
exports.getMovementsByClient = async (req, res) => {
    const { clientId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;

    if (!clientId) {
        return res.status(400).json({
            success: false,
            message: 'ID de cliente requerido'
        });
    }

    try {
        // Verificar que el cliente existe
        const client = await Client.findById(clientId);
        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Cliente no encontrado'
            });
        }

        const movements = await Movement.findByClient(clientId, limit);

        return res.status(200).json({
            success: true,
            cliente: `${client.nombres} ${client.apellidos}`,
            count: movements.length,
            data: movements
        });
    } catch (error) {
        console.error('Error al obtener movimientos:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener movimientos',
            error: error.message
        });
    }
};

// Resumen de movimientos
exports.getMovementsSummary = async (req, res) => {
    const { accountId } = req.params;
    const { periodo = 'ESTE_MES' } = req.query;

    if (!accountId) {
        return res.status(400).json({
            success: false,
            message: 'ID de cuenta requerido'
        });
    }

    try {
        const summary = await Movement.getSummary(accountId, periodo);

        return res.status(200).json({
            success: true,
            periodo,
            data: summary
        });
    } catch (error) {
        console.error('Error al obtener resumen:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener resumen de movimientos',
            error: error.message
        });
    }
};

// Estado de cuenta
exports.getAccountStatement = async (req, res) => {
    const { accountId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;

    if (!accountId) {
        return res.status(400).json({
            success: false,
            message: 'ID de cuenta requerido'
        });
    }

    try {
        // Obtener información de la cuenta
        const accountInfo = await Account.findById(accountId);
        if (!accountInfo) {
            return res.status(404).json({
                success: false,
                message: 'Cuenta no encontrada'
            });
        }

        // Obtener movimientos
        const movements = await Movement.findByAccount(accountId, limit);

        // Obtener resumen del mes
        const summary = await Movement.getSummary(accountId, 'ESTE_MES');

        return res.status(200).json({
            success: true,
            cuenta: {
                id_cuenta: accountInfo.id_cuenta,
                numero_cuenta: accountInfo.numero_cuenta,
                tipo_cuenta: accountInfo.tipo_cuenta,
                moneda: accountInfo.moneda,
                saldo_actual: accountInfo.saldo,
                estado: accountInfo.estado
            },
            resumen_mes: summary,
            movimientos: {
                total: movements.length,
                datos: movements
            }
        });
    } catch (error) {
        console.error('Error al obtener estado de cuenta:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener estado de cuenta',
            error: error.message
        });
    }
};

// Movimiento por ID
exports.getMovementById = async (req, res) => {
    const { movementId } = req.params;

    if (!movementId) {
        return res.status(400).json({
            success: false,
            message: 'ID de movimiento requerido'
        });
    }

    try {
        const movement = await Movement.findById(movementId);

        if (!movement) {
            return res.status(404).json({
                success: false,
                message: 'Movimiento no encontrado'
            });
        }

        return res.status(200).json({
            success: true,
            data: movement
        });
    } catch (error) {
        console.error('Error al obtener movimiento:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener movimiento',
            error: error.message
        });
    }
};
