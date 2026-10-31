CREATE DATABASE IF NOT EXISTS docverifier CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'truedocs'@'localhost' IDENTIFIED BY 'truedocs_dev_2024';
GRANT ALL PRIVILEGES ON docverifier.* TO 'truedocs'@'localhost';
FLUSH PRIVILEGES;
SELECT 'Database setup complete' AS status;
