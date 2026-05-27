/**
 * Logger Service - Para registrar logs visibles en Railway
 * Railway captura automáticamente todos los logs en stdout y stderr
 */

class Logger {
  constructor(serviceName = 'API') {
    this.serviceName = serviceName;
  }

  /**
   * Formatea un log con timestamp y nivel
   */
  formatLog(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const log = {
      timestamp,
      level,
      service: this.serviceName,
      message,
      ...(data && { data })
    };
    return JSON.stringify(log);
  }

  /**
   * Log de información
   */
  info(message, data = null) {
    console.log(this.formatLog('INFO', message, data));
  }

  /**
   * Log de warning
   */
  warn(message, data = null) {
    console.warn(this.formatLog('WARN', message, data));
  }

  /**
   * Log de error - Registra en stderr para que Railroad lo vea como error
   */
  error(message, error = null, data = null) {
    const errorData = {
      ...data,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    };
    console.error(this.formatLog('ERROR', message, errorData));
  }

  /**
   * Log específico para transferencias
   */
  transferencia(action, status, transferData = null) {
    const data = {
      action,
      status,
      ...(transferData && { transfer: transferData })
    };
    
    if (status === 'error' || status === 'ERROR') {
      this.error(`Transferencia - ${action}`, null, data);
    } else if (status === 'warning' || status === 'RECHAZADO') {
      this.warn(`Transferencia - ${action}`, data);
    } else {
      this.info(`Transferencia - ${action}`, data);
    }
  }

  /**
   * Log de transacción completada
   */
  transactionComplete(transactionId, status, details = null) {
    this.info(`Transaction Complete: ${transactionId}`, {
      status,
      ...details
    });
  }

  /**
   * Log de transacción fallida
   */
  transactionFailed(transactionId, error, details = null) {
    this.error(`Transaction Failed: ${transactionId}`, error, details);
  }
}

module.exports = Logger;
