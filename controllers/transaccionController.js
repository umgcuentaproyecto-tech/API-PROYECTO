const Transaction = require('../models/transaccionModel');
const Movement = require('../models/movimientoModel');
const AuditService = require('../utils/auditService');

// Crear una nueva transacción (depósito o retiro)
const createTransaction = async (req, res) => {
    const { id_cuenta, tipo, monto, referencia } = req.body;

    // Validar entrada
    if (!id_cuenta || !tipo || !monto) {
        return res.status(400).json({ 
            success: false, 
            message: 'Datos incompletos' 
        });
    }

    if (!['DEPOSITO', 'RETIRO'].includes(tipo)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Tipo de operación inválida' 
        });
    }

    if (monto <= 0) {
        return res.status(400).json({ 
            success: false, 
            message: 'El monto debe ser mayor a 0' 
        });
    }

    try {
        // Obtener información de la cuenta
        const accountInfo = await Transaction.getAccountBalance(id_cuenta);
        if (!accountInfo) {
            return res.status(404).json({ 
                success: false, 
                message: 'Cuenta no encontrada' 
            });
        }

        // Validar que la cuenta esté activa
        if (accountInfo.estado !== 'ACTIVA') {
            return res.status(400).json({ 
                success: false, 
                message: `La cuenta debe estar ACTIVA. Estado actual: ${accountInfo.estado}` 
            });
        }

        // Para retiros, validar saldo disponible
        if (tipo === 'RETIRO' && accountInfo.saldo < monto) {
            return res.status(400).json({ 
                success: false, 
                message: `Saldo insuficiente. Saldo disponible: ${accountInfo.saldo}` 
            });
        }

        // Calcular nuevo saldo
        let newBalance;
        if (tipo === 'DEPOSITO') {
            newBalance = parseFloat(accountInfo.saldo) + parseFloat(monto);
        } else {
            newBalance = parseFloat(accountInfo.saldo) - parseFloat(monto);
        }

        // Crear la transacción
        const transactionId = await Transaction.create({
            id_cuenta,
            tipo,
            monto: parseFloat(monto),
            referencia: referencia || `${tipo} registrado por usuario`
        });

        // Actualizar el saldo de la cuenta
        await Transaction.updateAccountBalance(id_cuenta, newBalance);

        // Registrar movimiento en la tabla de movimientos
        const movementType = tipo === 'DEPOSITO' ? 'DEPOSITO' : 'RETIRO';
        await Movement.create({
            id_cuenta,
            numero_cuenta: accountInfo.numero_cuenta,
            tipo_movimiento: movementType,
            monto: parseFloat(monto),
            saldo_anterior: parseFloat(accountInfo.saldo),
            saldo_posterior: parseFloat(newBalance),
            referencia: referencia || null,
            descripcion: `${tipo} registrado exitosamente`,
            estado: 'COMPLETADO'
        });

        // Auditoría
        await AuditService.transaccion(tipo, id_cuenta, monto, {
            numero_cuenta: accountInfo.numero_cuenta,
            cliente: accountInfo.nombre_cliente,
            saldo_anterior: accountInfo.saldo,
            saldo_nuevo: newBalance
        }, req.user, req);

        return res.status(201).json({ 
            success: true, 
            message: `${tipo} registrado exitosamente`,
            data: {
                id_transaccion: transactionId,
                numero_cuenta: accountInfo.numero_cuenta,
                nombre_cliente: accountInfo.nombre_cliente,
                tipo,
                monto,
                saldo_anterior: accountInfo.saldo,
                saldo_nuevo: newBalance,
                referencia
            }
        });
    } catch (error) {
        console.error('Error al crear transacción:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error al procesar la operación',
            error: error.message 
        });
    }
};

// Obtener transacciones de una cuenta específica
const getAccountTransactions = async (req, res) => {
    const { accountId } = req.params;

    if (!accountId) {
        return res.status(400).json({ 
            success: false, 
            message: 'ID de cuenta requerido' 
        });
    }

    try {
        const transactions = await Transaction.findByAccount(accountId);
        return res.status(200).json({ 
            success: true, 
            count: transactions.length,
            data: transactions 
        });
    } catch (error) {
        console.error('Error al obtener transacciones:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error al obtener transacciones',
            error: error.message 
        });
    }
};

// Obtener todas las transacciones (últimas 100)
const getAllTransactions = async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;

    try {
        const transactions = await Transaction.findAll(limit);
        return res.status(200).json({ 
            success: true, 
            count: transactions.length,
            data: transactions 
        });
    } catch (error) {
        console.error('Error al obtener transacciones:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error al obtener transacciones',
            error: error.message 
        });
    }
};

module.exports = {
    createTransaction,
    getAccountTransactions,
    getAllTransactions
};
