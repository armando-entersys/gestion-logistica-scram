-- Seed data for staging environment
-- Creates test orders with various statuses

-- Pedidos READY (listos para asignar)
INSERT INTO orders (
  bind_id, order_number, warehouse_name, employee_name, client_number,
  client_name, client_email, client_phone, client_rfc,
  address_raw, latitude, longitude, status, priority_level, total_amount,
  is_vip, promised_date, assigned_driver_id, route_position, carrier_type
) VALUES
(
  'BIND-TEST-001', 'PE-T001', 'Almacen Central', 'Maria Lopez', 'CLI-TEST-001',
  'Empresa de Pruebas S.A. de C.V.', 'contacto@empresapruebas.com', '5551234567', 'EPR123456ABC',
  '{"street": "Av Insurgentes Sur", "number": "1234", "neighborhood": "Del Valle", "postalCode": "03100", "city": "CDMX", "state": "Ciudad de Mexico", "reference": "Edificio azul"}',
  19.3782, -99.1769, 'READY', 1, 15250.00, false, CURRENT_DATE + 1, NULL, NULL, 'INTERNAL'
),
(
  'BIND-TEST-002', 'PE-T002', 'Almacen Central', 'Carlos Hernandez', 'CLI-TEST-002',
  'Distribuidora Demo S.A.', 'ventas@distribuidorademo.mx', '5559876543', 'DDE987654XYZ',
  '{"street": "Calle 5 de Mayo", "number": "89", "neighborhood": "Centro", "postalCode": "06000", "city": "CDMX", "state": "Ciudad de Mexico", "reference": "Frente al Zocalo"}',
  19.4328, -99.1332, 'READY', 2, 45780.50, true, CURRENT_DATE, NULL, NULL, 'INTERNAL'
),
(
  'BIND-TEST-003', 'PE-T003', 'Almacen Norte', 'Maria Lopez', 'CLI-TEST-003',
  'Comercializadora Test', 'info@comercializadoratest.com', '5555555555', 'CTT111222333',
  '{"street": "Paseo de la Reforma", "number": "222", "neighborhood": "Juarez", "postalCode": "06600", "city": "CDMX", "state": "Ciudad de Mexico", "reference": "Torre Mayor"}',
  19.4277, -99.1621, 'READY', 3, 89500.00, false, CURRENT_DATE, NULL, NULL, 'INTERNAL'
),
-- Pedidos IN_TRANSIT asignados a Juan
(
  'BIND-TEST-004', 'PE-T004', 'Almacen Central', 'Carlos Hernandez', 'CLI-TEST-001',
  'Empresa de Pruebas S.A. de C.V.', 'contacto@empresapruebas.com', '5551234567', 'EPR123456ABC',
  '{"street": "Calzada Vallejo", "number": "567", "neighborhood": "Industrial Vallejo", "postalCode": "02300", "city": "CDMX", "state": "Ciudad de Mexico", "reference": "Bodega grande"}',
  19.4891, -99.1505, 'IN_TRANSIT', 1, 23450.00, false, CURRENT_DATE,
  (SELECT id FROM users WHERE email = 'juan@scram.local'), 1, 'INTERNAL'
),
(
  'BIND-TEST-005', 'PE-T005', 'Almacen Central', 'Maria Lopez', 'CLI-TEST-002',
  'Distribuidora Demo S.A.', 'ventas@distribuidorademo.mx', '5559876543', 'DDE987654XYZ',
  '{"street": "Av Tlahuac", "number": "3456", "neighborhood": "Santa Isabel Industrial", "postalCode": "09820", "city": "CDMX", "state": "Ciudad de Mexico", "reference": "Nave 5"}',
  19.3015, -99.0892, 'IN_TRANSIT', 2, 67890.00, true, CURRENT_DATE,
  (SELECT id FROM users WHERE email = 'juan@scram.local'), 2, 'INTERNAL'
),
-- Pedidos IN_TRANSIT asignados a Pedro
(
  'BIND-TEST-006', 'PE-T006', 'Almacen Norte', 'Carlos Hernandez', 'CLI-TEST-003',
  'Comercializadora Test', 'info@comercializadoratest.com', '5555555555', 'CTT111222333',
  '{"street": "Av Universidad", "number": "1000", "neighborhood": "Santa Cruz Atoyac", "postalCode": "03310", "city": "CDMX", "state": "Ciudad de Mexico", "reference": "Junto a metro"}',
  19.3650, -99.1635, 'IN_TRANSIT', 1, 12300.00, false, CURRENT_DATE,
  (SELECT id FROM users WHERE email = 'pedro@scram.local'), 1, 'INTERNAL'
),
-- Pedido DELIVERED
(
  'BIND-TEST-007', 'PE-T007', 'Almacen Central', 'Maria Lopez', 'CLI-TEST-001',
  'Empresa de Pruebas S.A. de C.V.', 'contacto@empresapruebas.com', '5551234567', 'EPR123456ABC',
  '{"street": "Av Insurgentes Sur", "number": "1234", "neighborhood": "Del Valle", "postalCode": "03100", "city": "CDMX", "state": "Ciudad de Mexico", "reference": "Edificio azul"}',
  19.3782, -99.1769, 'DELIVERED', 1, 34500.00, false, CURRENT_DATE - 1,
  (SELECT id FROM users WHERE email = 'juan@scram.local'), NULL, 'INTERNAL'
),
-- Pedido DRAFT
(
  'BIND-TEST-008', 'PE-T008', 'Almacen Central', 'Carlos Hernandez', 'CLI-TEST-002',
  'Distribuidora Demo S.A.', 'ventas@distribuidorademo.mx', '5559876543', 'DDE987654XYZ',
  '{"street": "Calle 5 de Mayo", "number": "89", "neighborhood": "Centro", "postalCode": "06000", "city": "CDMX", "state": "Ciudad de Mexico", "reference": "Frente al Zocalo"}',
  19.4328, -99.1332, 'DRAFT', 1, 8900.00, false, CURRENT_DATE + 2, NULL, NULL, 'INTERNAL'
)
ON CONFLICT (bind_id) DO NOTHING;

-- Update delivered_at for delivered orders
UPDATE orders SET delivered_at = NOW() - INTERVAL '2 hours' WHERE status = 'DELIVERED' AND bind_id LIKE 'BIND-TEST%';
