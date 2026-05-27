const crypto = require('crypto');
const pool = require('../config/database');
const Movement = require('./movimientoModel');

const LOCAL_SWIFT = process.env.BANK_SWIFT || 'GTBC6968';

function createTransactionId(swiftOrigen) {
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${swiftOrigen}-${datePart}-${randomPart}`;
}

class Transfer {
  static async findAll() {
    const [rows] = await pool.query(
      `SELECT
         t.id_transferencia,
         t.transaction_id,
         t.cuenta_origen,
         t.cuenta_destino,
         t.swift_origen,
         t.swift_destino,
         t.monto,
         t.estado,
         t.descripcion,
         t.motivo_rechazo,
         t.fecha_solicitud,
         t.fecha_respuesta,
         t.id_cuenta_origen,
         t.id_cuenta_destino,
         t.cuenta_origen_externa,
         t.nombre_cuenta_origen_externa,
         t.cuenta_destino_externa,
         t.tipo_transferencia,
         t.direccion,
         bo.nombre AS banco_origen,
         bd.nombre AS banco_destino
       FROM transferencias t
       INNER JOIN bancos bo ON bo.codigo_swift = t.swift_origen
       INNER JOIN bancos bd ON bd.codigo_swift = t.swift_destino
       ORDER BY t.created_at DESC`
    );

    return rows;
  }

  static async create(data, user = null) {
    const monto = Number(data.monto);
    const swiftOrigen = LOCAL_SWIFT;
    const swiftDestino = data.swift_destino || data.swiftDestino || LOCAL_SWIFT;
    const cuentaOrigen = data.cuenta_origen || data.cuentaOrigen;
    const cuentaDestino = data.cuenta_destino || data.cuentaDestino;
    const transactionId = createTransactionId(swiftOrigen);

    // Campos adicionales
    const cuentaOrigenId = data.cuentaOrigenId || data.id_cuenta_origen || null;
    const cuentaDestinoId = data.cuentaDestinoId || data.id_cuenta_destino || null;
    const cuentaOrigenExterna = data.cuentaOrigenExterna || data.cuenta_origen_externa || null;
    const nombreCuentaOrigenExterna = data.nombreCuentaOrigenExterna || data.nombre_cuenta_origen_externa || null;
    const cuentaDestinoExterna = data.cuentaDestinoExterna || data.cuenta_destino_externa || null;
    const tipoTransferencia = data.tipo || data.tipo_transferencia || null;
    const direccion = data.direccion || null;

    if (!cuentaOrigen || !cuentaDestino || !monto || monto <= 0) {
      throw new Error('Cuenta origen, cuenta destino y monto positivo son requeridos');
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [originRows] = await connection.query(
        `SELECT * FROM cuentas
         WHERE numero_cuenta = ? AND swift_banco = ? AND estado = 'ACTIVA'
         FOR UPDATE`,
        [cuentaOrigen, LOCAL_SWIFT]
      );

      const originAccount = originRows[0];
      if (!originAccount) {
        throw new Error('La cuenta origen no existe o no esta activa');
      }

      if (Number(originAccount.saldo) < monto) {
        throw new Error('Saldo insuficiente en la cuenta origen');
      }

      const [bankRows] = await connection.query(
        'SELECT * FROM bancos WHERE codigo_swift = ? AND activo = TRUE',
        [swiftDestino]
      );

      const destinationBank = bankRows[0];
      if (!destinationBank) {
        throw new Error('El banco destino no esta registrado o no esta activo');
      }

      const [result] = await connection.query(
        `INSERT INTO transferencias (
           transaction_id, cuenta_origen, cuenta_destino, swift_origen,
           swift_destino, monto, estado, descripcion, fecha_respuesta,
           id_cuenta_origen, id_cuenta_destino, cuenta_origen_externa,
           nombre_cuenta_origen_externa, cuenta_destino_externa, tipo_transferencia, direccion
         ) VALUES (?, ?, ?, ?, ?, ?, 'APROBADA', ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId,
          cuentaOrigen,
          cuentaDestino,
          LOCAL_SWIFT,
          swiftDestino,
          monto,
          data.descripcion || null,
          cuentaOrigenId,
          cuentaDestinoId,
          cuentaOrigenExterna,
          nombreCuentaOrigenExterna,
          cuentaDestinoExterna,
          tipoTransferencia,
          direccion
        ]
      );

      if (swiftDestino === LOCAL_SWIFT) {
        await this.processInternalTransfer(connection, {
          idTransferencia: result.insertId,
          transactionId,
          cuentaOrigen: data.cuenta_origen,
          cuentaDestino: data.cuenta_destino,
          monto,
          user,
          ipOrigen: data.ipOrigen,
          nombreUsuario: data.nombreUsuario
        });
      } else {
        const originAccountBefore = await connection.query(
          'SELECT id_cuenta, saldo FROM cuentas WHERE numero_cuenta = ?',
          [data.cuenta_origen]
        );
        const originSaldoAnterior = originAccountBefore[0][0].saldo;
        const originAccountId = originAccountBefore[0][0].id_cuenta;

        await connection.query(
          'UPDATE cuentas SET saldo = saldo - ? WHERE numero_cuenta = ?',
          [monto, data.cuenta_origen]
        );

        await this.registroAuditoria({
          idTransferencia: result.insertId,
          user,
          evento: 'TRANSFERENCIA_INTERBANCARIA_PENDIENTE',
          detalle: {
            transaction_id: transactionId,
            swift_destino: swiftDestino,
            cuenta_destino: data.cuenta_destino,
            monto
          },
          ipOrigen: data.ipOrigen,
          nombreUsuario: data.nombreUsuario
        });

        // Registrar movimiento para transferencia externa pendiente
        try {
          await Movement.create({
            id_cuenta: originAccountId,
            numero_cuenta: data.cuenta_origen,
            tipo_movimiento: 'TRANSFERENCIA_ENVIADA',
            monto: monto,
            saldo_anterior: parseFloat(originSaldoAnterior),
            saldo_posterior: parseFloat(originSaldoAnterior) - monto,
            referencia: transactionId,
            descripcion: `Transferencia a ${data.cuenta_destino} (Banco: ${swiftDestino})`,
            cuenta_origen: data.cuenta_origen,
            cuenta_destino: data.cuenta_destino,
            estado: 'PENDIENTE'
          }, connection);
        } catch (error) {
          console.error('Error al registrar movimiento:', error);
        }
      }

      await connection.commit();

      const transfer = await this.findById(result.insertId);

      if (swiftDestino !== LOCAL_SWIFT) {
        // Enviar a la otra API de forma asincrónica (sin bloquear)
        this.sendToExternalBank(transfer, destinationBank).catch(error => {
          console.error(`Error enviando transferencia ${transfer.transaction_id}:`, error.message);
        });
      }

      return transfer;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async processInternalTransfer(connection, data) {
    const [destinationRows] = await connection.query(
      `SELECT * FROM cuentas
       WHERE numero_cuenta = ? AND swift_banco = ? AND estado = 'ACTIVA'
       FOR UPDATE`,
      [data.cuentaDestino, LOCAL_SWIFT]
    );

    if (!destinationRows[0]) {
      await connection.query(
        `UPDATE transferencias
         SET estado = 'RECHAZADA', motivo_rechazo = ?, fecha_respuesta = CURRENT_TIMESTAMP
         WHERE id_transferencia = ?`,
        ['La cuenta destino local no existe o no esta activa', data.idTransferencia]
      );
      throw new Error('La cuenta destino local no existe o no esta activa');
    }

    const originAccountBefore = await connection.query(
      'SELECT saldo FROM cuentas WHERE numero_cuenta = ?',
      [data.cuentaOrigen]
    );
    const originSaldoAnterior = originAccountBefore[0][0].saldo;

    const destAccountBefore = await connection.query(
      'SELECT saldo FROM cuentas WHERE numero_cuenta = ?',
      [data.cuentaDestino]
    );
    const destSaldoAnterior = destAccountBefore[0][0].saldo;

    await connection.query(
      'UPDATE cuentas SET saldo = saldo - ? WHERE numero_cuenta = ?',
      [data.monto, data.cuentaOrigen]
    );
    await connection.query(
      'UPDATE cuentas SET saldo = saldo + ? WHERE numero_cuenta = ?',
      [data.monto, data.cuentaDestino]
    );
    await connection.query(
      `UPDATE transferencias
       SET estado = 'APROBADA', fecha_respuesta = CURRENT_TIMESTAMP
       WHERE id_transferencia = ?`,
      [data.idTransferencia]
    );

    await this.registroAuditoria({
      idTransferencia: data.idTransferencia,
      user: data.user,
      evento: 'TRANSFERENCIA_INTERNA_APROBADA',
      detalle: {
        transaction_id: data.transactionId,
        cuenta_origen: data.cuentaOrigen,
        cuenta_destino: data.cuentaDestino,
        monto: data.monto
      },
      ipOrigen: data.ipOrigen,
      nombreUsuario: data.nombreUsuario
    });

    // Registrar movimientos en la tabla de movimientos
    try {
      const [originAccountData] = await connection.query(
        'SELECT id_cuenta FROM cuentas WHERE numero_cuenta = ?',
        [data.cuentaOrigen]
      );
      const originAccountId = originAccountData[0].id_cuenta;

      const [destAccountData] = await connection.query(
        'SELECT id_cuenta FROM cuentas WHERE numero_cuenta = ?',
        [data.cuentaDestino]
      );
      const destAccountId = destAccountData[0].id_cuenta;

      // Movimiento de transferencia enviada
      await Movement.create({
        id_cuenta: originAccountId,
        numero_cuenta: data.cuentaOrigen,
        tipo_movimiento: 'TRANSFERENCIA_ENVIADA',
        monto: data.monto,
        saldo_anterior: parseFloat(originSaldoAnterior),
        saldo_posterior: parseFloat(originSaldoAnterior) - data.monto,
        referencia: data.transactionId,
        descripcion: `Transferencia a ${data.cuentaDestino}`,
        cuenta_origen: data.cuentaOrigen,
        cuenta_destino: data.cuentaDestino,
        estado: 'COMPLETADO'
      }, connection);

      // Movimiento de transferencia recibida
      await Movement.create({
        id_cuenta: destAccountId,
        numero_cuenta: data.cuentaDestino,
        tipo_movimiento: 'TRANSFERENCIA_RECIBIDA',
        monto: data.monto,
        saldo_anterior: parseFloat(destSaldoAnterior),
        saldo_posterior: parseFloat(destSaldoAnterior) + data.monto,
        referencia: data.transactionId,
        descripcion: `Transferencia desde ${data.cuentaOrigen}`,
        cuenta_origen: data.cuentaOrigen,
        cuenta_destino: data.cuentaDestino,
        estado: 'COMPLETADO'
      }, connection);
    } catch (error) {
      console.error('Error al registrar movimientos:', error);
      // No lanzar error, solo registrar en log para no afectar la transacción
    }
  }

  static async validateIncoming(data) {
    const payload = data.transfer || data;

    // Mapear nuevo formato estandarizado
    const transactionId = payload.TransactionID || payload.transactionId || payload.transaction_id;
    const cuentaOrigen = payload.cuentaOrigen || payload.cuenta_origen;
    const swiftOrigen = payload.swiftOrigen || payload.swift_origen;
    const cuentaDestino = payload.cuentaDestino || payload.cuenta_destino;
    const swiftDestino = payload.swiftDestino || payload.swift_destino || LOCAL_SWIFT;
    const nombreOrigen = payload.NombreOrigen || payload.nombreOrigen || payload.nombre_origen || 'Cliente Externo';
    const monto = Number(payload.monto);
    const descripcion = payload.descripcion;

    // Validar cada parámetro requerido
    let razonRechazo = '';
    if (!transactionId) razonRechazo += 'TransactionID requerido. ';
    if (!cuentaDestino) razonRechazo += 'cuentaDestino requerido. ';
    if (!monto || monto <= 0) razonRechazo += `Monto inválido (recibido: ${payload.monto}). `;

    if (razonRechazo) {
      return {
        status: 'RECHAZADO',
        reason: razonRechazo.trim(),
        parametrosRecibidos: payload
      };
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [destinationRows] = await connection.query(
        `SELECT * FROM cuentas
         WHERE numero_cuenta = ? AND swift_banco = ? AND estado = 'ACTIVA'
         FOR UPDATE`,
        [cuentaDestino, LOCAL_SWIFT]
      );

      const destinationAccount = destinationRows[0];
      if (!destinationAccount) {
        await connection.commit();
        return {
          status: 'RECHAZADO',
          reason: 'Cuenta destino no existe o no esta activa',
          detalles: `Cuenta buscada: ${cuentaDestino}, SWIFT: ${LOCAL_SWIFT}`
        };
      }

      // Validar que el banco origen exista en la BD
      const [bankOriginRows] = await connection.query(
        'SELECT * FROM bancos WHERE codigo_swift = ? AND activo = TRUE',
        [swiftOrigen]
      );

      if (!bankOriginRows || bankOriginRows.length === 0) {
        await connection.commit();
        return {
          status: 'RECHAZADO',
          reason: 'Banco origen no está registrado o no está activo en el sistema',
          detalles: `SWIFT origen: ${swiftOrigen}`
        };
      }

      // Acreditar la cuenta automáticamente
      const destSaldoAnterior = destinationAccount.saldo;
      await connection.query(
        'UPDATE cuentas SET saldo = saldo + ? WHERE numero_cuenta = ?',
        [monto, cuentaDestino]
      );

      const [result] = await connection.query(
        `INSERT INTO transferencias (
           transaction_id, cuenta_origen, cuenta_destino, swift_origen,
           swift_destino, monto, estado, descripcion, fecha_respuesta,
           id_cuenta_origen, id_cuenta_destino, cuenta_origen_externa,
           nombre_cuenta_origen_externa, cuenta_destino_externa, tipo_transferencia, direccion
         ) VALUES (?, ?, ?, ?, ?, ?, 'APROBADA', ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId,
          cuentaOrigen,
          cuentaDestino,
          swiftOrigen,
          LOCAL_SWIFT,
          monto,
          descripcion || `Transferencia interbancaria recibida de ${nombreOrigen}`,
          payload.id_cuenta_origen || payload.cuentaOrigenId || null,
          destinationAccount.id_cuenta,
          payload.cuentaOrigenExterna || payload.cuenta_origen_externa || null,
          payload.nombreCuentaOrigenExterna || payload.nombre_cuenta_origen_externa || nombreOrigen || null,
          payload.cuentaDestinoExterna || payload.cuenta_destino_externa || null,
          payload.tipo || payload.tipo_transferencia || null,
          payload.direccion || null
        ]
      );

      await this.registroAuditoria({
        idTransferencia: result.insertId,
        evento: 'TRANSFERENCIA_INTERBANCARIA_RECIBIDA_APROBADA',
        detalle: {
          transaction_id: transactionId,
          cuenta_origen: cuentaOrigen,
          swift_origen: swiftOrigen,
          cuenta_destino: cuentaDestino,
          monto,
          cliente_origen: nombreOrigen
        },
        ipOrigen: data.ipOrigen,
        nombreUsuario: data.nombreUsuario
      });

      // Registrar movimiento de transferencia recibida
      try {
        await Movement.create({
          id_cuenta: destinationAccount.id_cuenta,
          numero_cuenta: cuentaDestino,
          tipo_movimiento: 'TRANSFERENCIA_RECIBIDA',
          monto: monto,
          saldo_anterior: parseFloat(destSaldoAnterior),
          saldo_posterior: parseFloat(destSaldoAnterior) + monto,
          referencia: transactionId,
          descripcion: `Transferencia interbancaria recibida de ${nombreOrigen}`,
          cuenta_origen: cuentaOrigen,
          cuenta_destino: cuentaDestino,
          estado: 'COMPLETADO'
        }, connection);
      } catch (error) {
        console.error('Error al registrar movimiento de transferencia recibida:', error);
      }

      await connection.commit();

      return {
        status: 'APROBADO',
        TransactionID: transactionId
      };
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') {
        return {
          status: 'APROBADO',
          TransactionID: transactionId,
          message: 'Transferencia ya procesada'
        };
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  static async sendToExternalBank(transfer, bank) {
    // Enviar la transferencia a la API del banco destino sin bloquear
    if (!global.fetch) {
      console.log(`No se pudo enviar transferencia ${transfer.transaction_id}: fetch no disponible`);
      return;
    }

    try {
      // Obtener información del cliente origen
      const [clientRows] = await pool.query(
        `SELECT CONCAT(nombres, ' ', apellidos) AS nombreCliente FROM clientes LIMIT 1`
      );
      
      const nombreCliente = clientRows[0]?.nombreCliente || 'Cliente';

      const payload = {
        TransactionID: transfer.transaction_id,
        cuentaOrigen: transfer.cuenta_origen,
        swiftOrigen: transfer.swift_origen,
        cuentaDestino: transfer.cuenta_destino,
        swiftDestino: transfer.swift_destino,
        NombreOrigen: nombreCliente,
        monto: transfer.monto,
        descripcion: transfer.descripcion || 'Sin descripción'
      };

      console.log(`Enviando transferencia ${transfer.transaction_id} a ${bank.nombre}...`);

      const url_api = bank.url_api.replace(/\/$/, ''); // Remover slash final si existe
      const endpoint = bank.endpoint_transferencia || '/api/transferencias/interbancaria/entrante';
      const fullUrl = `${url_api}${endpoint}`;

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.warn(`${bank.nombre} retornó error ${response.status} para transferencia ${transfer.transaction_id}`, {
          payload,
          statusCode: response.status,
          statusText: response.statusText
        });
        return;
      }

      const result = await response.json();
      console.log(`Transferencia ${transfer.transaction_id} enviada exitosamente a ${bank.nombre}`);
      
    } catch (error) {
      console.error(`Error enviando a ${bank.nombre}:`, {
        message: error.message,
        error: error.toString(),
        payload
      });
    }
  }

  static async validateWithExternalBank(transfer, bank) {
    // Este método se mantiene por compatibilidad pero ya no se usa
    // Las transferencias se mantienen en PENDIENTE hasta que la otra API las apruebe
    return transfer;
  }

  static async updateExternalResponse(idTransferencia, estado, motivoRechazo = null) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [transferRows] = await connection.query(
        'SELECT * FROM transferencias WHERE id_transferencia = ? FOR UPDATE',
        [idTransferencia]
      );
      const transfer = transferRows[0];

      if (!transfer) {
        throw new Error('Transferencia no encontrada');
      }

      if (transfer.estado !== 'PENDIENTE') {
        await connection.commit();
        return this.findById(idTransferencia);
      }

      if (estado === 'RECHAZADA') {
        await connection.query(
          'UPDATE cuentas SET saldo = saldo + ? WHERE numero_cuenta = ?',
          [transfer.monto, transfer.cuenta_origen]
        );
      }

      await connection.query(
        `UPDATE transferencias
         SET estado = ?, motivo_rechazo = ?, fecha_respuesta = CURRENT_TIMESTAMP
         WHERE id_transferencia = ?`,
        [estado, motivoRechazo, idTransferencia]
      );

      await this.registroAuditoria({
        idTransferencia,
        evento: `TRANSFERENCIA_INTERBANCARIA_${estado}`,
        detalle: {
          transaction_id: transfer.transaction_id,
          estado,
          motivo_rechazo: motivoRechazo
        }
      });

      await connection.commit();
      return this.findById(idTransferencia);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async rejectPendingTransfer(transactionId, motivoRechazo = 'Rechazada por el banco destino') {
    try {
      const [transferRows] = await pool.query(
        'SELECT * FROM transferencias WHERE transaction_id = ?',
        [transactionId]
      );

      const transfer = transferRows[0];
      if (!transfer) {
        return {
          success: false,
          message: 'Transferencia no encontrada'
        };
      }

      if (transfer.estado !== 'PENDIENTE') {
        return {
          success: false,
          message: `No se puede rechazar una transferencia en estado ${transfer.estado}`
        };
      }

      await this.updateExternalResponse(transfer.id_transferencia, 'RECHAZADA', motivoRechazo);
      
      // Notificar a la otra API que fue rechazada
      await this.notifyExternalBank(transfer, 'RECHAZADA', motivoRechazo);
      
      return {
        success: true,
        message: 'Transferencia rechazada exitosamente'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  static async approveIncomingTransfer(transactionId, user = null) {
    try {
      const [transferRows] = await pool.query(
        'SELECT * FROM transferencias WHERE transaction_id = ?',
        [transactionId]
      );

      const transfer = transferRows[0];
      if (!transfer) {
        return {
          success: false,
          message: 'Transferencia no encontrada'
        };
      }

      if (transfer.estado !== 'PENDIENTE') {
        return {
          success: false,
          message: `No se puede aprobar una transferencia en estado ${transfer.estado}`
        };
      }

      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        // Acreditar la cuenta
        await connection.query(
          'UPDATE cuentas SET saldo = saldo + ? WHERE numero_cuenta = ?',
          [transfer.monto, transfer.cuenta_destino]
        );

        // Actualizar estado a APROBADA
        await connection.query(
          `UPDATE transferencias
           SET estado = 'APROBADA', fecha_respuesta = CURRENT_TIMESTAMP
           WHERE transaction_id = ?`,
          [transactionId]
        );

        await this.registroAuditoria({
          idTransferencia: transfer.id_transferencia,
          user,
          evento: 'TRANSFERENCIA_INTERBANCARIA_APROBADA',
          detalle: {
            transaction_id: transactionId,
            cuenta_destino: transfer.cuenta_destino,
            monto: transfer.monto
          }
        });

        await connection.commit();

        // Notificar a la otra API que fue aprobada
        await this.notifyExternalBank(transfer, 'APROBADA', 'Transferencia aprobada');

        return {
          success: true,
          message: 'Transferencia aprobada exitosamente'
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  static async notifyExternalBank(transfer, estado, mensaje = '') {
    try {
      // Obtener el banco origen para conseguir su URL
      const [bankRows] = await pool.query(
        'SELECT * FROM bancos WHERE codigo_swift = ? AND activo = TRUE',
        [transfer.swift_origen]
      );

      const originBank = bankRows[0];
      if (!originBank || !originBank.url_api) {
        console.log(`No hay URL para notificar al banco ${transfer.swift_origen}`);
        return;
      }

      if (!global.fetch) {
        console.log('Fetch no disponible para notificar a banco origen');
        return;
      }

      const payload = {
        transaction_id: transfer.transaction_id,
        estado: estado,
        mensaje: mensaje,
        timestamp: new Date().toISOString()
      };

      console.log(`Notificando a ${originBank.nombre} sobre transferencia ${transfer.transaction_id}: ${estado}`);

      const response = await fetch(`${originBank.url_api}/api/transferencias/notificacion-resultado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 5000
      });

      if (response.ok) {
        console.log(`Notificación enviada a ${originBank.nombre}`);
      } else {
        console.warn(`${originBank.nombre} retornó ${response.status} para notificación`);
      }
    } catch (error) {
      console.error(`Error notificando a banco origen:`, error.message);
      // No lanzar error, es solo una notificación
    }
  }

  static async processNotification(transactionId, estado, mensaje = '') {
    try {
      const [transferRows] = await pool.query(
        'SELECT * FROM transferencias WHERE transaction_id = ?',
        [transactionId]
      );

      const transfer = transferRows[0];
      if (!transfer) {
        return {
          success: false,
          message: 'Transferencia no encontrada'
        };
      }

      if (transfer.estado !== 'PENDIENTE') {
        return {
          success: false,
          message: `Transferencia ya está en estado ${transfer.estado}`
        };
      }

      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        // Actualizar estado según la notificación
        await connection.query(
          `UPDATE transferencias
           SET estado = ?, fecha_respuesta = CURRENT_TIMESTAMP
           WHERE transaction_id = ?`,
          [estado, transactionId]
        );

        // Si fue APROBADA, acreditar la cuenta
        if (estado === 'APROBADA') {
          await connection.query(
            'UPDATE cuentas SET saldo = saldo + ? WHERE numero_cuenta = ?',
            [transfer.monto, transfer.cuenta_destino]
          );
        }

        // Si fue RECHAZADA, revertir el débito de la cuenta origen
        if (estado === 'RECHAZADA') {
          await connection.query(
            'UPDATE cuentas SET saldo = saldo + ? WHERE numero_cuenta = ?',
            [transfer.monto, transfer.cuenta_origen]
          );
        }

        await this.registroAuditoria({
          idTransferencia: transfer.id_transferencia,
          evento: `TRANSFERENCIA_INTERBANCARIA_NOTIFICACION_${estado}`,
          detalle: {
            transaction_id: transactionId,
            estado,
            mensaje
          }
        });

        await connection.commit();

        return {
          success: true,
          message: `Transferencia actualizada a ${estado}`
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  static async findById(id) {
    const [rows] = await pool.query(
      `SELECT
         t.id_transferencia,
         t.transaction_id,
         t.cuenta_origen,
         t.cuenta_destino,
         t.swift_origen,
         t.swift_destino,
         t.monto,
         t.estado,
         t.descripcion,
         t.motivo_rechazo,
         t.fecha_solicitud,
         t.fecha_respuesta,
         t.id_cuenta_origen,
         t.id_cuenta_destino,
         t.cuenta_origen_externa,
         t.nombre_cuenta_origen_externa,
         t.cuenta_destino_externa,
         t.tipo_transferencia,
         t.direccion,
         bo.nombre AS banco_origen,
         bd.nombre AS banco_destino
       FROM transferencias t
       INNER JOIN bancos bo ON bo.codigo_swift = t.swift_origen
       INNER JOIN bancos bd ON bd.codigo_swift = t.swift_destino
       WHERE t.id_transferencia = ?`,
      [id]
    );

    return rows[0] || null;
  }

  static async getCatalogs() {
    const [accounts] = await pool.query(
      `SELECT
         c.numero_cuenta,
         c.tipo_cuenta,
         c.moneda,
         c.saldo,
         c.estado,
         CONCAT(cl.nombres, ' ', cl.apellidos) AS cliente
       FROM cuentas c
       INNER JOIN clientes cl ON cl.id_cliente = c.id_cliente
       WHERE c.swift_banco = ?
       ORDER BY c.numero_cuenta`,
      [LOCAL_SWIFT]
    );

    const [banks] = await pool.query(
      'SELECT nombre, codigo_swift, url_api FROM bancos WHERE activo = TRUE ORDER BY nombre'
    );

    return { accounts, banks, local_swift: LOCAL_SWIFT };
  }

  static async validateDestinationAccount(data) {
    const { cuenta_destino, swift_destino } = data;

    if (!cuenta_destino || !swift_destino) {
      return {
        success: false,
        message: 'Cuenta destino y SWIFT destino son requeridos'
      };
    }

    // Si es una transferencia local, validar en la base de datos local
    if (swift_destino === LOCAL_SWIFT) {
      try {
        const [rows] = await pool.query(
          `SELECT
             c.numero_cuenta,
             c.tipo_cuenta,
             c.moneda,
             c.estado,
             CONCAT(cl.nombres, ' ', cl.apellidos) AS cliente,
             b.nombre AS banco
           FROM cuentas c
           INNER JOIN clientes cl ON cl.id_cliente = c.id_cliente
           INNER JOIN bancos b ON b.codigo_swift = c.swift_banco
           WHERE c.numero_cuenta = ? AND c.swift_banco = ? AND c.estado = 'ACTIVA'`,
          [cuenta_destino, LOCAL_SWIFT]
        );

        if (rows.length === 0) {
          return {
            success: false,
            message: 'La cuenta destino no existe o no está activa en este banco'
          };
        }

        return {
          success: true,
          data: rows[0]
        };
      } catch (error) {
        return {
          success: false,
          message: 'Error al validar la cuenta destino: ' + error.message
        };
      }
    }

    // Si es una transferencia interbancaria, llamar a la API del banco destino
    try {
      const [bankRows] = await pool.query(
        'SELECT nombre, codigo_swift, url_api FROM bancos WHERE codigo_swift = ? AND activo = TRUE',
        [swift_destino]
      );

      if (bankRows.length === 0) {
        return {
          success: false,
          message: 'El banco destino no está registrado o no está activo'
        };
      }

      const destinationBank = bankRows[0];

      // Llamar a la API del banco destino
      if (!global.fetch) {
        return {
          success: false,
          message: 'No se puede validar con el banco destino en este momento'
        };
      }

      try {
        const response = await fetch(`${destinationBank.url_api}/api/transferencias/validar-cuenta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cuenta_destino: cuenta_destino
          })
        });

        if (!response.ok) {
          return {
            success: false,
            message: `El banco ${destinationBank.nombre} rechazó la validación de la cuenta`
          };
        }

        const payload = await response.json();

        if (payload.success) {
          return {
            success: true,
            data: {
              numero_cuenta: payload.data?.numero_cuenta || cuenta_destino,
              cliente: payload.data?.cliente || 'Cliente Externo',
              banco: destinationBank.nombre,
              tipo_cuenta: payload.data?.tipo_cuenta || 'DESCONOCIDO',
              estado: payload.data?.estado || 'ACTIVO'
            }
          };
        } else {
          return {
            success: false,
            message: payload.message || `No se encontró la cuenta en ${destinationBank.nombre}`
          };
        }
      } catch (fetchError) {
        // Si hay error de conexión, retornar un mensaje informativo
        return {
          success: false,
          message: `No se pudo conectar con el banco ${destinationBank.nombre}. Por favor, intente más tarde.`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Error al validar la cuenta destino: ' + error.message
      };
    }
  }

  static async validateAccountExternal(numeroCuenta, codigoSwift) {
    try {
      const [bankRows] = await pool.query(
        'SELECT * FROM bancos WHERE codigo_swift = ? AND activo = TRUE',
        [codigoSwift]
      );

      const bank = bankRows[0];
      if (!bank) {
        return {
          existe: false,
          error: 'Banco no encontrado o no activo'
        };
      }

      if (!global.fetch) {
        return {
          existe: false,
          error: 'Fetch no disponible'
        };
      }

      const response = await fetch(`${bank.url_api}/api/cuentas`, {
        method: 'GET',
        headers: { 'accept': 'application/json' }
      });

      if (!response.ok) {
        return {
          existe: false,
          error: 'No se pudo obtener las cuentas del banco destino'
        };
      }

      const cuentas = await response.json();
      
      // Buscar la cuenta específica en el listado
      const cuenta = Array.isArray(cuentas) ? cuentas.find(c => c.numeroCuenta === numeroCuenta) : null;
      
      if (!cuenta) {
        return {
          existe: false,
          error: 'Cuenta no encontrada en el banco destino'
        };
      }

      const payload = cuenta;
      
      // Log para depuración - ver exactamente qué devuelve el otro banco
      console.log(`[DEBUG] Respuesta de ${bank.nombre} para cuenta ${numeroCuenta}:`, JSON.stringify(payload, null, 2));
      
      return {
        existe: true,
        numeroCuenta: payload.numeroCuenta || numeroCuenta,
        nombreCliente: payload.nombreCliente || payload.nombre || 'Cliente Externo',
        banco: bank.nombre,
        tipoCuenta: payload.tipoCuenta || payload.tipo_cuenta || payload.tipo || payload.type || payload.accountType || payload.tipoDeProducto || 'DESCONOCIDO',
        estado: payload.estado || 'ACTIVO',
        // Incluir datos crudos para depuración
        _rawData: payload
      };
    } catch (error) {
      return {
        existe: false,
        error: error.message
      };
    }
  }

  
  static async registroAuditoria(data) {
    const WS_AUDITORIA_URL = process.env.WS_AUDITORIA_URL || 'http://localhost:3001/api/auditoria';
    

    fetch(WS_AUDITORIA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idTransferencia: data.idTransferencia || null,
        idUsuario: data.user?.id_usuario || null,
        evento: data.evento,
        detalle: data.detalle || {},
        ipOrigen: data.ipOrigen || null,
        userAgent: data.userAgent || null,
        timestamp: new Date()
      })
    }).catch(err => console.error('Error registrando auditoría:', err));
  }
}

module.exports = Transfer;
