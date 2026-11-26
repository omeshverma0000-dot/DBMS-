-- SmartPark database (MySQL 5.7+ / 8.x)
-- Run:  mysql -u root -p < schema.sql
CREATE DATABASE IF NOT EXISTS smartpark;
USE smartpark;

DROP TABLE IF EXISTS parking_ticket;
DROP TABLE IF EXISTS parking_slot;
DROP TABLE IF EXISTS rate_card;

CREATE TABLE rate_card (
  vehicle_type  ENUM('Bike','Car','EV') PRIMARY KEY,
  rate_per_hour DECIMAL(6,2) NOT NULL
);

CREATE TABLE parking_slot (
  slot_id   VARCHAR(8) PRIMARY KEY,
  floor_no  INT NOT NULL,
  slot_type ENUM('Bike','Car','EV') NOT NULL,
  status    ENUM('FREE','OCCUPIED') NOT NULL DEFAULT 'FREE',
  FOREIGN KEY (slot_type) REFERENCES rate_card(vehicle_type)
);

CREATE TABLE parking_ticket (
  ticket_id    INT AUTO_INCREMENT PRIMARY KEY,
  plate_no     VARCHAR(13) NOT NULL,
  vehicle_type ENUM('Bike','Car','EV') NOT NULL,
  slot_id      VARCHAR(8) NOT NULL,
  entry_time   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  exit_time    DATETIME NULL,
  fee          DECIMAL(8,2) NULL,
  pay_method   ENUM('UPI','Card','Cash') NULL,
  status       ENUM('ACTIVE','PAID') NOT NULL DEFAULT 'ACTIVE',
  FOREIGN KEY (slot_id) REFERENCES parking_slot(slot_id),
  FOREIGN KEY (vehicle_type) REFERENCES rate_card(vehicle_type)
) AUTO_INCREMENT=1001;

INSERT INTO rate_card VALUES ('Bike',10),('Car',30),('EV',40);

INSERT INTO parking_slot (slot_id, floor_no, slot_type) VALUES
  ('F1-01',1,'Bike'),('F1-02',1,'Bike'),('F1-03',1,'Bike'),('F1-04',1,'Bike'),
  ('F1-05',1,'Bike'),('F1-06',1,'Bike'),('F1-07',1,'Bike'),('F1-08',1,'Bike'),
  ('F2-01',2,'Car'),('F2-02',2,'Car'),('F2-03',2,'Car'),('F2-04',2,'Car'),
  ('F2-05',2,'Car'),('F2-06',2,'Car'),('F2-07',2,'Car'),('F2-08',2,'Car'),
  ('F3-01',3,'Car'),('F3-02',3,'Car'),('F3-03',3,'Car'),('F3-04',3,'Car'),
  ('F3-05',3,'Car'),('F3-06',3,'EV'),('F3-07',3,'EV'),('F3-08',3,'EV');

-- ===== Sample queries for the report / viva =====
-- Free slots per floor
SELECT floor_no, COUNT(*) AS free_slots FROM parking_slot WHERE status='FREE' GROUP BY floor_no;
-- Revenue by vehicle type
SELECT vehicle_type, SUM(fee) AS revenue FROM parking_ticket WHERE status='PAID' GROUP BY vehicle_type;
-- Vehicles parked over 3 hours
SELECT plate_no, slot_id FROM parking_ticket WHERE status='ACTIVE' AND TIMESTAMPDIFF(HOUR, entry_time, NOW())>3;
-- Most used slots
SELECT slot_id, COUNT(*) AS uses FROM parking_ticket GROUP BY slot_id ORDER BY uses DESC LIMIT 5;
-- Active tickets with current bill (JOIN)
SELECT t.ticket_id, t.plate_no, t.slot_id,
       GREATEST(1, CEIL(TIMESTAMPDIFF(MINUTE, t.entry_time, NOW())/60)) * r.rate_per_hour AS bill_now
FROM parking_ticket t JOIN rate_card r ON r.vehicle_type=t.vehicle_type WHERE t.status='ACTIVE';
