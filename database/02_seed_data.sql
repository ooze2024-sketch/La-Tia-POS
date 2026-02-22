-- La Tia POS - Sample Seed Data
-- Created: 2026-02-22

USE latia_pos;

-- ============================================================================
-- INSERT ROLES
-- ============================================================================
INSERT INTO roles (name, description) VALUES 
('admin', 'Administrator - Full system access'),
('cashier', 'Cashier - Can process sales and manage orders'),
('manager', 'Manager - Can view reports and manage inventory');

-- ============================================================================
-- INSERT USERS
-- ============================================================================
INSERT INTO users (username, password_hash, role_id, full_name, email) VALUES 
('admin', '$2b$10$YourHashedPasswordHereForAdmin', 1, 'Owner', 'owner@latia.local'),
('cashier1', '$2b$10$YourHashedPasswordHereCashier1', 2, 'Maria Santos', 'maria@latia.local'),
('cashier2', '$2b$10$YourHashedPasswordHereCashier2', 2, 'Juan Dela Cruz', 'juan@latia.local'),
('manager', '$2b$10$YourHashedPasswordHereForManager', 3, 'Manager', 'manager@latia.local');

-- ============================================================================
-- INSERT CATEGORIES
-- ============================================================================
INSERT INTO categories (name, description) VALUES 
('Meals', 'Main meal items'),
('Drinks', 'Beverages'),
('Desserts', 'Sweet items'),
('Sides', 'Side dishes');

-- ============================================================================
-- INSERT PRODUCTS
-- ============================================================================
INSERT INTO products (sku, name, category_id, cost, price, description, is_active) VALUES 
('ADB-001', 'Adobo', 1, 20.00, 25.00, 'Classic Filipino adobo', 1),
('FR-001', 'Fried Rice', 1, 10.00, 25.00, 'Garlic fried rice', 1),
('SIL-001', 'Sinigang', 1, 25.00, 30.00, 'Pork sinigang', 1),
('REC-001', 'Reco', 1, 15.00, 20.00, 'Beef reco', 1),
('CK-001', 'Fried Chicken', 1, 18.00, 28.00, '2 pieces fried chicken', 1),
('PAP-001', 'Pap Buwan', 2, 5.00, 10.00, 'Papaya shake', 1),
('MIN-001', 'Minesohe', 2, 8.00, 12.00, 'Minesohe drink', 1),
('CB-001', 'Cold Brew', 2, 6.00, 12.00, 'Cold brew coffee', 1),
('HT-001', 'Hot Tea', 2, 3.00, 8.00, 'Iced or hot tea', 1),
('LE-001', 'Leche Flan', 3, 8.00, 15.00, 'Homemade leche flan', 1),
('TIR-001', 'Tiramisu', 3, 12.00, 18.00, 'Italian tiramisu', 1),
('BR-001', 'Brown Rice', 4, 5.00, 8.00, 'Brown rice side', 1),
('VEG-001', 'Mixed Vegetables', 4, 10.00, 15.00, 'Cooked vegetables', 1);

-- ============================================================================
-- INSERT INVENTORY ITEMS
-- ============================================================================
INSERT INTO inventory_items (product_id, name, quantity, unit, reorder_level) VALUES 
(1, 'Pork Shoulder', 50.000, 'kg', 10.000),
(2, 'Rice', 100.000, 'kg', 20.000),
(3, 'Pork Loin', 30.000, 'kg', 8.000),
(4, 'Beef', 25.000, 'kg', 5.000),
(5, 'Chicken Pieces', 60.000, 'pieces', 15.000),
(6, 'Papaya', 15.000, 'pcs', 3.000),
(7, 'Pineapple', 10.000, 'pcs', 2.000),
(8, 'Coffee Beans', 5.000, 'kg', 1.000),
(9, 'Tea Leaves', 2.000, 'kg', 0.500),
(10, 'Eggs', 200.000, 'pieces', 50.000),
(11, 'Milk', 20.000, 'liters', 5.000),
(12, 'Brown Rice', 50.000, 'kg', 10.000),
(13, 'Mixed Veggies Pack', 40.000, 'packs', 10.000);

-- ============================================================================
-- INSERT SUPPLIERS
-- ============================================================================
INSERT INTO suppliers (name, contact_info) VALUES 
('Metro Supplies', 'Phone: 555-0101, Email: sales@metro.local'),
('Fresh Farms Co.', 'Phone: 555-0102, Email: info@freshfarms.local'),
('Quality Ingredients', 'Phone: 555-0103, Email: order@quality.local');

-- ============================================================================
-- INSERT CUSTOMERS (Optional - for repeat customers)
-- ============================================================================
INSERT INTO customers (name, phone, email, notes) VALUES 
('Corporate Office A', '555-1001', 'corp.a@company.local', 'Bulk orders'),
('Regular Customer 1', '555-2001', 'customer1@email.local', 'Loyal customer'),
('Delivery Service', '555-3001', 'delivery@service.local', 'Wholesale');

-- ============================================================================
-- Sample completed sale (for testing reports)
-- ============================================================================
INSERT INTO sales (public_reference, user_id, customer_id, subtotal, discount, tax, total, status, created_at) VALUES 
('SALE-20260222-001', 1, NULL, 50.00, 0.00, 2.50, 52.50, 'paid', DATE_SUB(NOW(), INTERVAL 2 HOUR));

INSERT INTO sale_items (sale_id, product_id, name, quantity, unit_price, line_total, cost) VALUES 
(1, 1, 'Adobo', 2, 25.00, 50.00, 40.00);

INSERT INTO payments (sale_id, method, amount, details) VALUES 
(1, 'card', 52.50, JSON_OBJECT('last4', '4242', 'authorization_code', 'AUTH123'));

-- ============================================================================
-- Sample stock movement (purchase)
-- ============================================================================
INSERT INTO stock_movements (inventory_item_id, movement_type, quantity, unit_cost, notes) VALUES 
(1, 'purchase', 50.000, 19.00, 'Initial purchase from Metro Supplies');

-- ============================================================================
-- Confirmations
-- ============================================================================
SELECT '✓ Database setup complete!' as status;
SELECT COUNT(*) as total_roles FROM roles;
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_categories FROM categories;
SELECT COUNT(*) as total_products FROM products;
SELECT COUNT(*) as total_inventory FROM inventory_items;
