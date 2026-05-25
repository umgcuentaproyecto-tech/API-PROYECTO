/**
 * Servicio de auditoría centralizado
 * Envía eventos de auditoría a un WS externo de forma asincronizada
 */

class AuditService {
  static async registrar(data) {
    const WS_AUDITORIA_URL = process.env.WS_AUDITORIA_URL || 'http://localhost:3001/api/auditoria';
    
    // Envía de forma asincronizada sin bloquear la API
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
        tabla: data.tabla || null,
        registroId: data.registroId || null,
        operacion: data.operacion || null,
        timestamp: new Date()
      })
    }).catch(err => console.error('Error registrando auditoría:', err));
  }

  /**
   * Eventos estándar para CRUD
   */
  static async crear(tabla, registroId, detalles, usuario) {
    await this.registrar({
      tabla,
      registroId,
      evento: `${tabla.toUpperCase()}_CREADO`,
      operacion: 'CREATE',
      detalle: detalles,
      user: usuario
    });
  }

  static async actualizar(tabla, registroId, detalles, usuario) {
    await this.registrar({
      tabla,
      registroId,
      evento: `${tabla.toUpperCase()}_ACTUALIZADO`,
      operacion: 'UPDATE',
      detalle: detalles,
      user: usuario
    });
  }

  static async eliminar(tabla, registroId, detalles, usuario) {
    await this.registrar({
      tabla,
      registroId,
      evento: `${tabla.toUpperCase()}_ELIMINADO`,
      operacion: 'DELETE',
      detalle: detalles,
      user: usuario
    });
  }

  /**
   * Eventos de transacciones (depósitos/retiros)
   */
  static async transaccion(tipo, cuentaId, monto, detalles, usuario) {
    await this.registrar({
      tabla: 'transacciones',
      registroId: cuentaId,
      evento: `TRANSACCION_${tipo.toUpperCase()}`,
      operacion: tipo.toUpperCase(),
      detalle: {
        tipo,
        monto,
        ...detalles
      },
      user: usuario
    });
  }

  /**
   * Evento de login
   */
  static async login(usuario, exitoso, detalles = {}) {
    await this.registrar({
      tabla: 'usuarios',
      registroId: usuario?.id_usuario || null,
      evento: exitoso ? 'LOGIN_EXITOSO' : 'LOGIN_FALLIDO',
      operacion: 'LOGIN',
      detalle: detalles,
      user: usuario
    });
  }
}

module.exports = AuditService;
