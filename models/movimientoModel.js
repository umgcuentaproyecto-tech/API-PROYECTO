const database = require('../config/database');

class Movement {
    // Crear movimiento (con soporte para transacciones)
    static async create(movementData, connection = null) {
        const {
            id_cuenta,
            numero_cuenta,
            tipo_movimiento,
            monto,
            saldo_anterior,
            saldo_posterior,
            referencia,
            descripcion,
            cuenta_origen,
            cuenta_destino,
            estado = 'COMPLETADO'
        } = movementData;

        const query = `
            INSERT INTO movimientos 
            (id_cuenta, numero_cuenta, tipo_movimiento, monto, saldo_anterior, saldo_posterior, 
             referencia, descripcion, cuenta_origen, cuenta_destino, estado, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;

        const db = connection || database;
        const [result] = await db.query(query, [
            id_cuenta,
            numero_cuenta,
            tipo_movimiento,
            monto,
            saldo_anterior,
            saldo_posterior,
            referencia || null,
            descripcion || null,
            cuenta_origen || null,
            cuenta_destino || null,
            estado
        ]);

        return result.insertId;
    }

    // Obtener movimientos de una cuenta
    static async findByAccount(accountId, limit = 50) {
        const query = `
            SELECT 
                m.id_movimiento,
                m.id_cuenta,
                m.numero_cuenta,
                m.tipo_movimiento,
                m.monto,
                m.saldo_anterior,
                m.saldo_posterior,
                m.referencia,
                m.descripcion,
                m.cuenta_origen,
                m.cuenta_destino,
                m.estado,
                m.created_at
            FROM movimientos m
            WHERE m.id_cuenta = ?
            ORDER BY m.created_at DESC
            LIMIT ?
        `;

        const [rows] = await database.query(query, [accountId, limit]);
        return rows;
    }

    // Obtener movimientos de un cliente
    static async findByClient(clientId, limit = 100) {
        const query = `
            SELECT 
                m.id_movimiento,
                m.id_cuenta,
                m.numero_cuenta,
                m.tipo_movimiento,
                m.monto,
                m.saldo_anterior,
                m.saldo_posterior,
                m.referencia,
                m.descripcion,
                m.cuenta_origen,
                m.cuenta_destino,
                m.estado,
                m.created_at
            FROM movimientos m
            JOIN cuentas c ON m.id_cuenta = c.id_cuenta
            WHERE c.id_cliente = ?
            ORDER BY m.created_at DESC
            LIMIT ?
        `;

        const [rows] = await database.query(query, [clientId, limit]);
        return rows;
    }

    // Obtener todos los movimientos
    static async findAll(limit = 100) {
        const query = `
            SELECT 
                m.id_movimiento,
                m.id_cuenta,
                m.numero_cuenta,
                m.tipo_movimiento,
                m.monto,
                m.saldo_anterior,
                m.saldo_posterior,
                m.referencia,
                m.descripcion,
                m.cuenta_origen,
                m.cuenta_destino,
                m.estado,
                m.created_at,
                CONCAT(cl.nombres, ' ', cl.apellidos) as nombre_cliente
            FROM movimientos m
            JOIN cuentas c ON m.id_cuenta = c.id_cuenta
            JOIN clientes cl ON c.id_cliente = cl.id_cliente
            ORDER BY m.created_at DESC
            LIMIT ?
        `;

        const [rows] = await database.query(query, [limit]);
        return rows;
    }

    // Resumen de movimientos por tipo
    static async getSummary(accountId, periodo = 'ESTE_MES') {
        let dateFilter = '';
        
        switch(periodo) {
            case 'HOY':
                dateFilter = 'AND DATE(m.created_at) = DATE(NOW())';
                break;
            case 'ESTA_SEMANA':
                dateFilter = 'AND YEAR(m.created_at) = YEAR(NOW()) AND WEEK(m.created_at) = WEEK(NOW())';
                break;
            case 'ESTE_MES':
                dateFilter = 'AND YEAR(m.created_at) = YEAR(NOW()) AND MONTH(m.created_at) = MONTH(NOW())';
                break;
            default:
                dateFilter = '';
        }

        const query = `
            SELECT 
                m.tipo_movimiento,
                COUNT(*) as cantidad,
                SUM(m.monto) as total_monto,
                MIN(m.created_at) as primera_fecha,
                MAX(m.created_at) as ultima_fecha
            FROM movimientos m
            WHERE m.id_cuenta = ? ${dateFilter}
            GROUP BY m.tipo_movimiento
        `;

        const [rows] = await database.query(query, [accountId]);
        return rows;
    }

    // Obtener movimiento por ID
    static async findById(movementId) {
        const query = `
            SELECT 
                m.id_movimiento,
                m.id_cuenta,
                m.numero_cuenta,
                m.tipo_movimiento,
                m.monto,
                m.saldo_anterior,
                m.saldo_posterior,
                m.referencia,
                m.descripcion,
                m.cuenta_origen,
                m.cuenta_destino,
                m.estado,
                m.created_at
            FROM movimientos m
            WHERE m.id_movimiento = ?
        `;

        const [rows] = await database.query(query, [movementId]);
        return rows.length > 0 ? rows[0] : null;
    }
}

module.exports = Movement;
