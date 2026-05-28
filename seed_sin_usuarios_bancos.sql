USE bancoloscanchitos;

INSERT INTO clientes (nombres, apellidos, dpi, nit, telefono, email, direccion) VALUES
('Juan Carlos', 'Perez Lopez', '1234567890101', '1234567-8', '5555-0101', 'juan.perez@gmail.com', 'Ciudad de Guatemala'),
('Maria Fernanda', 'Garcia Morales', '2345678901202', '2345678-9', '5555-0202', 'maria.garcia@gmail.com', 'Mixco'),
('Carlos Estuardo', 'Lopez Ramirez', '3456789012303', '3456789-0', '5555-0303', 'carlos.lopez@gmail.com', 'Villa Nueva'),
('Ana Lucia', 'Hernandez Diaz', '4567890123404', '4567890-1', '5555-0404', 'ana.hernandez@gmail.com', 'Antigua Guatemala'),
('Pedro Jose', 'Ramirez Ortega', '5678901234505', '5678901-2', '5555-0505', 'pedro.ramirez@gmail.com', 'Quetzaltenango'),
('Sofia Isabel', 'Mendez Cruz', '6789012345606', '6789012-3', '5555-0606', 'sofia.mendez@gmail.com', 'Escuintla'),
('Luis Alberto', 'Gonzalez Ruiz', '7890123456707', '7890123-4', '5555-0707', 'luis.gonzalez@gmail.com', 'Chimaltenango'),
('Carmen Elena', 'Paz Morales', '8901234567808', '8901234-5', '5555-0808', 'carmen.paz@gmail.com', 'Santa Catarina Pinula'),
('Diego Fernando', 'Castillo Flores', '9012345678909', '9012345-6', '5555-0909', 'diego.castillo@gmail.com', 'Villa Nueva'),
('Valeria Andrea', 'Santos Lopez', '0123456789010', '0123456-7', '5555-1010', 'valeria.santos@gmail.com', 'San Miguel Petapa');

INSERT INTO cuentas (id_cliente, numero_cuenta, tipo_cuenta, moneda, saldo, swift_banco) VALUES
(1, '1000000001', 'MONETARIA', 'GTQ', 5000.00, 'GTBC6968'),
(2, '1000000002', 'AHORRO', 'GTQ', 8500.00, 'GTBC6968'),
(3, '1000000003', 'MONETARIA', 'GTQ', 12000.00, 'GTBC6968'),
(4, '1000000004', 'AHORRO', 'GTQ', 3200.00, 'GTBC6968'),
(5, '1000000005', 'MONETARIA', 'GTQ', 7600.00, 'GTBC6968'),
(6, '1000000006', 'AHORRO', 'GTQ', 9400.00, 'GTBC6968'),
(7, '1000000007', 'MONETARIA', 'GTQ', 1500.00, 'GTBC6968'),
(8, '1000000008', 'AHORRO', 'GTQ', 21800.00, 'GTBC6968'),
(9, '1000000009', 'MONETARIA', 'GTQ', 6300.00, 'GTBC6968'),
(10, '1000000010', 'AHORRO', 'GTQ', 11100.00, 'GTBC6968');