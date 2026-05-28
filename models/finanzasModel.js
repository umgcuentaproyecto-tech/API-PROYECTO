const pool = require('../config/database');

class Finance {
  static async getAccountsSummary() {
    const [rows] = await pool.query(
      `SELECT 
        id_cuenta,
        numero_cuenta,
        tipo_cuenta,
        moneda,
        saldo,
        estado,
        created_at
      FROM cuentas
      ORDER BY saldo DESC`
    );
    return rows;
  }

  static async getBalanceByType() {
    const [rows] = await pool.query(
      `SELECT 
        tipo_cuenta,
        COUNT(*) AS cantidad_cuentas,
        SUM(saldo) AS saldo_total
      FROM cuentas
      GROUP BY tipo_cuenta
      ORDER BY saldo_total DESC`
    );
    return rows;
  }

  static async getBalanceHistory(startDate, endDate) {
    const [rows] = await pool.query(
      `SELECT 
        DATE(created_at) AS fecha,
        SUM(CASE WHEN tipo_movimiento IN ('DEPOSITO', 'TRANSFERENCIA_RECIBIDA') THEN monto ELSE 0 END) AS ingresos,
        SUM(CASE WHEN tipo_movimiento IN ('RETIRO', 'TRANSFERENCIA_ENVIADA') THEN monto ELSE 0 END) AS egresos,
        SUM(CASE WHEN tipo_movimiento IN ('DEPOSITO', 'TRANSFERENCIA_RECIBIDA') THEN monto ELSE -monto END) AS neto,
        COUNT(*) AS total_movimientos
      FROM movimientos
      WHERE created_at BETWEEN ? AND ?
      GROUP BY DATE(created_at)
      ORDER BY fecha ASC`,
      [startDate, endDate]
    );
    return rows;
  }

  static async getDailyTransferSummary(startDate, endDate) {
    const [rows] = await pool.query(
      `SELECT
        DATE(fecha_solicitud) AS fecha,
        COUNT(*) AS total_transferencias,
        SUM(monto) AS monto_total,
        SUM(CASE WHEN estado = 'APROBADA' THEN 1 ELSE 0 END) AS aprobadas,
        SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN estado = 'RECHAZADA' THEN 1 ELSE 0 END) AS rechazadas
      FROM transferencias
      WHERE fecha_solicitud BETWEEN ? AND ?
      GROUP BY DATE(fecha_solicitud)
      ORDER BY fecha ASC`,
      [startDate, endDate]
    );
    return rows;
  }

  static async getVolumeByBank(startDate, endDate) {
    const [rows] = await pool.query(
      `SELECT
        t.swift_destino AS codigo_banco,
        IFNULL(b.nombre, t.swift_destino) AS nombre_banco,
        COUNT(*) AS cantidad_transferencias,
        SUM(t.monto) AS monto_total
      FROM transferencias t
      LEFT JOIN bancos b ON b.codigo_swift = t.swift_destino
      WHERE t.fecha_solicitud BETWEEN ? AND ?
      GROUP BY t.swift_destino
      ORDER BY monto_total DESC`,
      [startDate, endDate]
    );
    return rows;
  }

  static async getTotalsMoved(startDate, endDate) {
    const [rows] = await pool.query(
      `SELECT
        SUM(CASE WHEN tipo_movimiento IN ('DEPOSITO', 'TRANSFERENCIA_RECIBIDA') THEN monto ELSE 0 END) AS total_ingresos,
        SUM(CASE WHEN tipo_movimiento IN ('RETIRO', 'TRANSFERENCIA_ENVIADA') THEN monto ELSE 0 END) AS total_egresos,
        COUNT(*) AS total_movimientos
      FROM movimientos
      WHERE created_at BETWEEN ? AND ?`,
      [startDate, endDate]
    );
    return rows[0] || { total_ingresos: 0, total_egresos: 0, total_movimientos: 0 };
  }

  static async getAccountStatement(accountId, startDate, endDate, limit = 200) {
    const [accountRows] = await pool.query(
      `SELECT 
        c.id_cuenta,
        c.numero_cuenta,
        c.tipo_cuenta,
        c.moneda,
        c.saldo,
        c.estado,
        CONCAT(cl.nombres, ' ', cl.apellidos) AS nombre_cliente
      FROM cuentas c
      JOIN clientes cl ON cl.id_cliente = c.id_cliente
      WHERE c.id_cuenta = ?`,
      [accountId]
    );

    const account = accountRows[0] || null;
    if (!account) {
      return null;
    }

    const [movements] = await pool.query(
      `SELECT 
        id_movimiento,
        numero_cuenta,
        tipo_movimiento,
        monto,
        saldo_anterior,
        saldo_posterior,
        referencia,
        descripcion,
        cuenta_origen,
        cuenta_destino,
        estado,
        created_at
      FROM movimientos
      WHERE id_cuenta = ?
        AND created_at BETWEEN ? AND ?
      ORDER BY created_at DESC
      LIMIT ?`,
      [accountId, startDate, endDate, limit]
    );

    const [summary] = await pool.query(
      `SELECT
        SUM(CASE WHEN tipo_movimiento IN ('DEPOSITO', 'TRANSFERENCIA_RECIBIDA') THEN monto ELSE 0 END) AS ingresos,
        SUM(CASE WHEN tipo_movimiento IN ('RETIRO', 'TRANSFERENCIA_ENVIADA') THEN monto ELSE 0 END) AS egresos,
        COUNT(*) AS total_movimientos
      FROM movimientos
      WHERE id_cuenta = ?
        AND created_at BETWEEN ? AND ?`,
      [accountId, startDate, endDate]
    );

    return {
      account,
      summary: summary[0] || { ingresos: 0, egresos: 0, total_movimientos: 0 },
      movements
    };
  }

  static async getAlerts(thresholdLow = 1000, thresholdTransfer = 5000, thresholdSuspicious = 5000) {
    const [lowBalances] = await pool.query(
      `SELECT id_cuenta, numero_cuenta, tipo_cuenta, saldo, estado FROM cuentas
       WHERE saldo <= ?
       ORDER BY saldo ASC
       LIMIT 50`,
      [thresholdLow]
    );

    const [limitTransfers] = await pool.query(
      `SELECT id_transferencia, transaction_id, cuenta_origen, cuenta_destino, swift_destino, monto, estado, fecha_solicitud
       FROM transferencias
       WHERE monto >= ?
       ORDER BY monto DESC
       LIMIT 50`,
      [thresholdTransfer]
    );

    const [suspiciousTransfers] = await pool.query(
      `SELECT id_transferencia, transaction_id, cuenta_origen, cuenta_destino, swift_destino, monto, estado, fecha_solicitud
       FROM transferencias
       WHERE monto >= ?
       ORDER BY fecha_solicitud DESC
       LIMIT 50`,
      [thresholdSuspicious]
    );

    return {
      lowBalances,
      limitTransfers,
      suspiciousTransfers
    };
  }

  static async getDashboardSummary(startDate, endDate, previousStart, previousEnd) {
    const [currentMovements] = await pool.query(
      `SELECT
        SUM(CASE WHEN tipo_movimiento IN ('DEPOSITO', 'TRANSFERENCIA_RECIBIDA') THEN monto ELSE 0 END) AS total_ingresos,
        SUM(CASE WHEN tipo_movimiento IN ('RETIRO', 'TRANSFERENCIA_ENVIADA') THEN monto ELSE 0 END) AS total_egresos,
        COUNT(*) AS total_movimientos
      FROM movimientos
      WHERE created_at BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    const [currentTransfers] = await pool.query(
      `SELECT
        COUNT(*) AS total_transferencias,
        SUM(monto) AS monto_total_transferencias
      FROM transferencias
      WHERE fecha_solicitud BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    const [activeAccounts] = await pool.query(
      `SELECT COUNT(*) AS cuentas_activas FROM cuentas WHERE estado = 'ACTIVA'`
    );

    const [previousMovements] = await pool.query(
      `SELECT
        SUM(CASE WHEN tipo_movimiento IN ('DEPOSITO', 'TRANSFERENCIA_RECIBIDA') THEN monto ELSE 0 END) AS total_ingresos,
        SUM(CASE WHEN tipo_movimiento IN ('RETIRO', 'TRANSFERENCIA_ENVIADA') THEN monto ELSE 0 END) AS total_egresos
      FROM movimientos
      WHERE created_at BETWEEN ? AND ?`,
      [previousStart, previousEnd]
    );

    return {
      current: {
        total_ingresos: currentMovements[0].total_ingresos || 0,
        total_egresos: currentMovements[0].total_egresos || 0,
        total_movimientos: currentMovements[0].total_movimientos || 0,
        total_transferencias: currentTransfers[0].total_transferencias || 0,
        monto_total_transferencias: currentTransfers[0].monto_total_transferencias || 0,
        cuentas_activas: activeAccounts[0].cuentas_activas || 0
      },
      previous: {
        total_ingresos: previousMovements[0].total_ingresos || 0,
        total_egresos: previousMovements[0].total_egresos || 0
      }
    };
  }
}

module.exports = Finance;
