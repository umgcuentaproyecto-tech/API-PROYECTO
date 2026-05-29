const http = require('http');
const https = require('https');

function postJson(url, payload, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const body = JSON.stringify(payload);
    const client = target.protocol === 'https:' ? https : http;

    const request = client.request({
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: timeoutMs
    }, response => {
      let responseBody = '';

      response.setEncoding('utf8');
      response.on('data', chunk => {
        responseBody += chunk;
      });
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(responseBody);
          return;
        }

        reject(new Error(`WS auditoria respondio ${response.statusCode}: ${responseBody}`));
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Tiempo de espera agotado enviando auditoria'));
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function formatFechaGuatemala(date) {
  const parts = new Intl.DateTimeFormat('es-GT', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function getNombreUsuario(data) {
  return data.nombreUsuario ||
    data.user?.nombre ||
    data.user?.email ||
    data.detalle?.nombreUsuario ||
    data.detalle?.usuario ||
    null;
}

/**
 * Servicio de auditoria centralizado.
 * Envia eventos al web service externo sin bloquear la respuesta principal.
 */
class AuditService {
  static async registrar(data = {}) {
    const WS_AUDITORIA_URL = process.env.WS_AUDITORIA_URL || 'http://localhost:3001/api/auditoria';

    if (process.env.AUDITORIA_ENABLED === 'false' || !data.evento) {
      return;
    }

    const timestamp = new Date();

    const payload = {
      idTransferencia: data.idTransferencia || null,
      idUsuario: data.user?.id_usuario || data.idUsuario || null,
      nombreUsuario: getNombreUsuario(data),
      evento: data.evento,
      detalle: data.detalle || {},
      ipOrigen: data.ipOrigen || null,
      userAgent: data.userAgent || null,
      tabla: data.tabla || null,
      registroId: data.registroId || null,
      operacion: data.operacion || null,
      timestamp,
      fechaGuatemala: formatFechaGuatemala(timestamp),
      zonaHoraria: 'America/Guatemala'
    };

    postJson(WS_AUDITORIA_URL, payload)
      .catch(err => console.error('Error registrando auditoria:', err.message));
  }

  static getContextoRequest(req) {
    if (!req) {
      return {};
    }

    return {
      ipOrigen: req.ip || req.connection?.remoteAddress || null,
      userAgent: req.headers?.['user-agent'] || null
    };
  }

  static async crear(tabla, registroId, detalles, usuario, req = null) {
    await this.registrar({
      tabla,
      registroId,
      evento: `${tabla.toUpperCase()}_CREADO`,
      operacion: 'CREATE',
      detalle: detalles,
      user: usuario,
      ...this.getContextoRequest(req)
    });
  }

  static async actualizar(tabla, registroId, detalles, usuario, req = null) {
    await this.registrar({
      tabla,
      registroId,
      evento: `${tabla.toUpperCase()}_ACTUALIZADO`,
      operacion: 'UPDATE',
      detalle: detalles,
      user: usuario,
      ...this.getContextoRequest(req)
    });
  }

  static async eliminar(tabla, registroId, detalles, usuario, req = null) {
    await this.registrar({
      tabla,
      registroId,
      evento: `${tabla.toUpperCase()}_ELIMINADO`,
      operacion: 'DELETE',
      detalle: detalles,
      user: usuario,
      ...this.getContextoRequest(req)
    });
  }

  static async transaccion(tipo, cuentaId, monto, detalles, usuario, req = null) {
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
      user: usuario,
      ...this.getContextoRequest(req)
    });
  }

  static async login(usuario, exitoso, detalles = {}, req = null) {
    await this.registrar({
      tabla: 'usuarios',
      registroId: usuario?.id_usuario || null,
      evento: exitoso ? 'LOGIN_EXITOSO' : 'LOGIN_FALLIDO',
      operacion: 'LOGIN',
      detalle: detalles,
      user: usuario,
      ...this.getContextoRequest(req)
    });
  }
}

module.exports = AuditService;
