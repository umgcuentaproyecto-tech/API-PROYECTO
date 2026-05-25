
CREATE DATABASE IF NOT EXISTS bancoloscanchitos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bancoloscanchitos;


SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS movimientos;
DROP TABLE IF EXISTS transacciones;
DROP TABLE IF EXISTS transferencias;
DROP TABLE IF EXISTS cuentas;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS bancos;
SET FOREIGN_KEY_CHECKS = 1;



CREATE TABLE bancos (
  id_banco INT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  codigo_swift VARCHAR(50) NOT NULL UNIQUE,
  url_api VARCHAR(255) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP 
    ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE usuarios (
  id_usuario INT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('NUEVO_USUARIO', 'ADMIN', 'OPERADOR', 'FINANZAS', 'AUDITOR') NOT NULL DEFAULT 'NUEVO_USUARIO',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


CREATE TABLE clientes (
  id_cliente INT PRIMARY KEY AUTO_INCREMENT,
  nombres VARCHAR(120) NOT NULL,
  apellidos VARCHAR(120) NOT NULL,
  dpi VARCHAR(20) NOT NULL UNIQUE,
  nit VARCHAR(20) NULL,
  telefono VARCHAR(25) NULL,
  email VARCHAR(160) NULL UNIQUE,
  direccion VARCHAR(255) NULL,
  estado ENUM('ACTIVO', 'INACTIVO', 'BLOQUEADO') NOT NULL DEFAULT 'ACTIVO',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


CREATE TABLE cuentas (
  id_cuenta INT PRIMARY KEY AUTO_INCREMENT,
  id_cliente INT NOT NULL,
  numero_cuenta VARCHAR(30) NOT NULL UNIQUE,
  tipo_cuenta ENUM('MONETARIA', 'AHORRO') NOT NULL DEFAULT 'MONETARIA',
  moneda CHAR(3) NOT NULL DEFAULT 'GTQ',
  saldo DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  swift_banco VARCHAR(11) NOT NULL,
  estado ENUM('ACTIVA', 'INACTIVA', 'BLOQUEADA', 'CERRADA') NOT NULL DEFAULT 'ACTIVA',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cuentas_cliente
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
  CONSTRAINT fk_cuentas_banco_swift
    FOREIGN KEY (swift_banco) REFERENCES bancos(codigo_swift),
  CONSTRAINT chk_cuentas_saldo_no_negativo CHECK (saldo >= 0)
);


CREATE TABLE transferencias (
  id_transferencia BIGINT PRIMARY KEY AUTO_INCREMENT,
  transaction_id CHAR(36) NOT NULL UNIQUE,
  cuenta_origen VARCHAR(30) NOT NULL,
  cuenta_destino VARCHAR(30) NOT NULL,
  swift_origen VARCHAR(11) NOT NULL,
  swift_destino VARCHAR(11) NOT NULL,
  monto DECIMAL(14,2) NOT NULL,
  moneda CHAR(3) NOT NULL DEFAULT 'GTQ',
  estado ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA') NOT NULL DEFAULT 'PENDIENTE',
  descripcion VARCHAR(255) NULL,
  motivo_rechazo VARCHAR(255) NULL,
  fecha_solicitud TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_respuesta TIMESTAMP NULL,
  id_cuenta_origen INT NULL,
  id_cuenta_destino INT NULL,
  cuenta_origen_externa VARCHAR(30) NULL,
  nombre_cuenta_origen_externa VARCHAR(120) NULL,
  cuenta_destino_externa VARCHAR(30) NULL,
  tipo_transferencia VARCHAR(50) NULL,
  direccion VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_transferencias_swift_origen
    FOREIGN KEY (swift_origen) REFERENCES bancos(codigo_swift),
  CONSTRAINT fk_transferencias_swift_destino
    FOREIGN KEY (swift_destino) REFERENCES bancos(codigo_swift),
  CONSTRAINT chk_transferencias_monto_positivo CHECK (monto > 0),
  INDEX idx_transferencias_estado (estado),
  INDEX idx_transferencias_cuenta_origen (cuenta_origen),
  INDEX idx_transferencias_cuenta_destino (cuenta_destino),
  INDEX idx_transferencias_swift_destino (swift_destino)
);


CREATE TABLE transacciones (
  id_transaccion BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_cuenta INT NOT NULL,
  tipo ENUM('DEPOSITO', 'RETIRO') NOT NULL,
  monto DECIMAL(14,2) NOT NULL,
  referencia VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_transacciones_cuenta
    FOREIGN KEY (id_cuenta) REFERENCES cuentas(id_cuenta),
  CONSTRAINT chk_transacciones_monto_positivo CHECK (monto > 0),
  INDEX idx_transacciones_id_cuenta (id_cuenta),
  INDEX idx_transacciones_created_at (created_at)
);


CREATE TABLE movimientos (
  id_movimiento BIGINT PRIMARY KEY AUTO_INCREMENT,
  id_cuenta INT NOT NULL,
  numero_cuenta VARCHAR(30) NOT NULL,
  tipo_movimiento ENUM('DEPOSITO', 'RETIRO', 'TRANSFERENCIA_ENVIADA', 'TRANSFERENCIA_RECIBIDA') NOT NULL,
  monto DECIMAL(14,2) NOT NULL,
  saldo_anterior DECIMAL(14,2) NOT NULL,
  saldo_posterior DECIMAL(14,2) NOT NULL,
  referencia VARCHAR(255) NULL,
  descripcion VARCHAR(255) NULL,
  cuenta_origen VARCHAR(30) NULL,
  cuenta_destino VARCHAR(30) NULL,
  estado ENUM('COMPLETADO', 'PENDIENTE', 'RECHAZADO') NOT NULL DEFAULT 'COMPLETADO',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_movimientos_cuenta
    FOREIGN KEY (id_cuenta) REFERENCES cuentas(id_cuenta),
  CONSTRAINT chk_movimientos_monto_positivo CHECK (monto > 0),
  INDEX idx_movimientos_id_cuenta (id_cuenta),
  INDEX idx_movimientos_created_at (created_at),
  INDEX idx_movimientos_tipo (tipo_movimiento),
  INDEX idx_movimientos_numero_cuenta (numero_cuenta)
);


INSERT INTO bancos (nombre, codigo_swift, url_api) VALUES
('Banco Los Canchitos', 'GTBC6968', 'http://localhost:8081'),
('NOVABANK', 'GTB666', 'https://apibanca.onrender.com');

-- Datos de prueba para desarrollo local.
INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
('Administrador Banco', 'admin@banco.local', '$2a$10$9s2gOUoaZnKDIi8v2L4QleS6BHlDfzJQy0p4Ju/oWZrWQ39xv55ce', 'ADMIN'),
('Operador Banco', 'operador@banco.local', '$2a$10$d1rsvplN5ov19DXTSGYoL.vzD9W//2kzXEKKECCNlG6077NG2AV0i', 'OPERADOR'),
('Finanzas Banco', 'finanzas@banco.local', '$2a$10$d1rsvplN5ov19DXTSGYoL.vzD9W//2kzXEKKECCNlG6077NG2AV0i', 'FINANZAS');

INSERT INTO clientes (nombres, apellidos, dpi, nit, telefono, email, direccion) VALUES
('Juan Carlos', 'Perez Lopez', '1234567890101', '1234567-8', '5555-0101', 'juan.perez@example.com', 'Ciudad de Guatemala'),
('Maria Fernanda', 'Garcia Morales', '2345678901202', '2345678-9', '5555-0202', 'maria.garcia@example.com', 'Mixco'),
('Carlos Estuardo', 'Lopez Ramirez', '3456789012303', '3456789-0', '5555-0303', 'carlos.lopez@example.com', 'Villa Nueva');

INSERT INTO cuentas (id_cliente, numero_cuenta, tipo_cuenta, moneda, saldo, swift_banco) VALUES
(1, '1000000001', 'MONETARIA', 'GTQ', 5000.00, 'GTBC6968'),
(2, '1000000002', 'AHORRO', 'GTQ', 8500.00, 'GTBC6968'),
(3, '1000000003', 'MONETARIA', 'GTQ', 12000.00, 'GTBC6968');

INSERT INTO transferencias (
  transaction_id,
  cuenta_origen,
  cuenta_destino,
  swift_origen,
  swift_destino,
  monto,
  moneda,
  estado,
  descripcion
) VALUES (
  UUID(),
  '1000000001',
  '2000000001',
  'GTBC6968',
  'GTRUXXXX',
  250.00,
  'GTQ',
  'PENDIENTE',
  'Transferencia interbancaria de prueba'
);
