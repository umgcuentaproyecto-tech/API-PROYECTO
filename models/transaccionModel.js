const database = require('../config/database');

class Transaction {
    static async create(transactionData) {
        const { id_cuenta, tipo, monto, referencia } = transactionData;

        const query = `
            INSERT INTO transacciones 
            (id_cuenta, tipo, monto, referencia, created_at, updated_at) 
            VALUES (?, ?, ?, ?, NOW(), NOW())
        `;

        const [result] = await database.query(query, [
            id_cuenta,
            tipo,
            monto,
            referencia
        ]);

        return result.insertId;
    }

    static async findByAccount(accountId) {
        const query = `
            SELECT 
                t.id_transaccion,
                t.id_cuenta,
                c.numero_cuenta,
                CONCAT(cl.nombres, ' ', cl.apellidos) as nombre_cliente,
                c.moneda,
                t.tipo,
                t.monto,
                t.referencia,
                t.created_at,
                t.updated_at
            FROM transacciones t
            JOIN cuentas c ON t.id_cuenta = c.id_cuenta
            JOIN clientes cl ON c.id_cliente = cl.id_cliente
            WHERE t.id_cuenta = ?
            ORDER BY t.created_at DESC
            LIMIT 50
        `;

        const [rows] = await database.query(query, [accountId]);
        return rows;
    }

    static async findAll(limit = 100) {
        const query = `
            SELECT 
                t.id_transaccion,
                t.id_cuenta,
                c.numero_cuenta,
                CONCAT(cl.nombres, ' ', cl.apellidos) as nombre_cliente,
                c.moneda,
                t.tipo,
                t.monto,
                t.referencia,
                t.created_at,
                t.updated_at
            FROM transacciones t
            JOIN cuentas c ON t.id_cuenta = c.id_cuenta
            JOIN clientes cl ON c.id_cliente = cl.id_cliente
            ORDER BY t.created_at DESC
            LIMIT ?
        `;

        const [rows] = await database.query(query, [limit]);
        return rows;
    }

    static async getAccountBalance(accountId) {
        const query = `
            SELECT 
                c.saldo,
                c.numero_cuenta,
                CONCAT(cl.nombres, ' ', cl.apellidos) as nombre_cliente,
                c.moneda,
                c.estado,
                c.tipo_cuenta
            FROM cuentas c
            JOIN clientes cl ON c.id_cliente = cl.id_cliente
            WHERE c.id_cuenta = ?
        `;

        const [rows] = await database.query(query, [accountId]);
        if (rows.length === 0) return null;
        return rows[0];
    }

    static async updateAccountBalance(accountId, newBalance) {
        const query = `
            UPDATE cuentas 
            SET saldo = ?, updated_at = NOW()
            WHERE id_cuenta = ?
        `;

        const [result] = await database.query(query, [newBalance, accountId]);
        return result.affectedRows > 0;
    }
}

module.exports = Transaction;
