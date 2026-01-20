-- ==============================================
-- Migration: Add webhook support columns
-- Date: 2026-01-20
-- Description: Add columns for invoice-based order creation via webhooks
-- ==============================================

-- Orders table: Add invoice-related columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bind_invoice_id VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source VARCHAR(20) DEFAULT 'BIND_ORDER';

-- Create index for bind_invoice_id
CREATE INDEX IF NOT EXISTS idx_orders_bind_invoice_id ON orders(bind_invoice_id);

-- Clients table: Add bind_id column
ALTER TABLE clients ADD COLUMN IF NOT EXISTS bind_id VARCHAR(50);

-- Create index for clients bind_id
CREATE INDEX IF NOT EXISTS idx_clients_bind_id ON clients(bind_id);

-- Update existing orders to have default order_source
UPDATE orders SET order_source = 'BIND_ORDER' WHERE order_source IS NULL;

-- Add comment to columns for documentation
COMMENT ON COLUMN orders.bind_invoice_id IS 'UUID de la factura en Bind (si origen es factura)';
COMMENT ON COLUMN orders.invoice_number IS 'Número de factura Bind (ej: FA15821)';
COMMENT ON COLUMN orders.order_source IS 'Origen de la orden: BIND_ORDER, BIND_INVOICE, MANUAL';
COMMENT ON COLUMN clients.bind_id IS 'UUID del cliente en Bind ERP';

-- Verification
SELECT
    'orders' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name IN ('bind_invoice_id', 'invoice_number', 'order_source');

SELECT
    'clients' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'clients'
AND column_name = 'bind_id';
