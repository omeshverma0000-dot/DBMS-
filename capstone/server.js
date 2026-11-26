// SmartPark backend: Express REST API on top of MySQL
const express = require('express'), mysql = require('mysql2/promise'), path = require('path');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const pool = mysql.createPool({ ...require('./config'), decimalNumbers: true, waitForConnections: true, connectionLimit: 5 });

const bad = (m, s = 400) => Object.assign(new Error(m), { status: s });
const wrap = fn => (req, res) => fn(req, res).catch(e => {
  console.error(e);
  res.status(e.status || 500).json({ error: e.status ? e.message : 'Database error: ' + (e.code || e.message) });
});
// ticket row shaped for the frontend (times as epoch milliseconds, id shown as T1001)
const TK = `SELECT CONCAT('T',ticket_id) AS ticket_id, plate_no, vehicle_type, slot_id,
  UNIX_TIMESTAMP(entry_time)*1000 AS entry_time, UNIX_TIMESTAMP(exit_time)*1000 AS exit_time,
  fee, pay_method, status FROM parking_ticket`;

// READ: full state (slots, tickets, rates)
app.get('/api/state', wrap(async (req, res) => {
  const [slots] = await pool.query('SELECT slot_id, floor_no, slot_type, status FROM parking_slot ORDER BY slot_id');
  const [tickets] = await pool.query(TK + ' ORDER BY parking_ticket.ticket_id');
  const [rates] = await pool.query('SELECT vehicle_type, rate_per_hour FROM rate_card');
  res.json({ slots, tickets, rates });
}));

// CREATE: vehicle entry (transaction: INSERT ticket + UPDATE slot)
app.post('/api/park', wrap(async (req, res) => {
  const plate = String(req.body.plate || '').toUpperCase().replace(/\s+/g, ''), type = req.body.type, sid = req.body.slot_id || null;
  if (!/^[A-Z0-9-]{4,12}$/.test(plate)) throw bad('Enter a valid registration number (4-12 letters/digits)');
  if (!['Bike', 'Car', 'EV'].includes(type)) throw bad('Invalid vehicle type');
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [dup] = await c.query("SELECT 1 FROM parking_ticket WHERE plate_no=? AND status='ACTIVE' FOR UPDATE", [plate]);
    if (dup.length) throw bad('This vehicle already has an active ticket');
    const [s] = await c.query("SELECT slot_id FROM parking_slot WHERE status='FREE' AND slot_type=?" + (sid ? ' AND slot_id=?' : '') + ' ORDER BY slot_id LIMIT 1 FOR UPDATE', sid ? [type, sid] : [type]);
    if (!s.length) throw bad('No free ' + type + ' slot available');
    const [r] = await c.query('INSERT INTO parking_ticket(plate_no, vehicle_type, slot_id) VALUES (?,?,?)', [plate, type, s[0].slot_id]);
    await c.query("UPDATE parking_slot SET status='OCCUPIED' WHERE slot_id=?", [s[0].slot_id]);
    await c.commit();
    const [t] = await pool.query(TK + ' WHERE parking_ticket.ticket_id=?', [r.insertId]);
    res.json(t[0]);
  } catch (e) { await c.rollback(); throw e; } finally { c.release(); }
}));

// UPDATE: exit + payment (fee computed in SQL with a JOIN on rate_card)
app.post('/api/pay', wrap(async (req, res) => {
  const id = parseInt(String(req.body.ticket_id || '').slice(1)), m = req.body.method;
  if (!id || !['UPI', 'Card', 'Cash'].includes(m)) throw bad('Invalid request');
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [a] = await c.query("SELECT slot_id FROM parking_ticket WHERE ticket_id=? AND status='ACTIVE' FOR UPDATE", [id]);
    if (!a.length) throw bad('Ticket not found or already paid', 404);
    await c.query(`UPDATE parking_ticket t JOIN rate_card r ON r.vehicle_type=t.vehicle_type
      SET t.exit_time=NOW(), t.fee=GREATEST(1, CEIL(TIMESTAMPDIFF(MINUTE, t.entry_time, NOW())/60))*r.rate_per_hour,
          t.pay_method=?, t.status='PAID' WHERE t.ticket_id=?`, [m, id]);
    await c.query("UPDATE parking_slot SET status='FREE' WHERE slot_id=?", [a[0].slot_id]);
    await c.commit();
    const [t] = await pool.query(TK + ' WHERE parking_ticket.ticket_id=?', [id]);
    res.json(t[0]);
  } catch (e) { await c.rollback(); throw e; } finally { c.release(); }
}));

// RESET: restore demo data
async function seedDemo() {
  await pool.query('DELETE FROM parking_ticket');
  await pool.query('ALTER TABLE parking_ticket AUTO_INCREMENT=1001');
  await pool.query("UPDATE parking_slot SET status='FREE'");
  const demo = [['DL01AB1234', 'Car', 'F2-01', 130, 1], ['DL08CX9087', 'Bike', 'F1-02', 45, 1], ['UP16EV5521', 'EV', 'F3-06', 200, 1], ['HR26DK4410', 'Car', 'F2-02', 300, 0]];
  for (const [p, t, s, mins, active] of demo) {
    await pool.query('INSERT INTO parking_ticket(plate_no, vehicle_type, slot_id, entry_time) VALUES (?,?,?, NOW() - INTERVAL ? MINUTE)', [p, t, s, mins]);
    if (active) await pool.query("UPDATE parking_slot SET status='OCCUPIED' WHERE slot_id=?", [s]);
  }
  await pool.query(`UPDATE parking_ticket t JOIN rate_card r ON r.vehicle_type=t.vehicle_type
    SET t.exit_time=NOW() - INTERVAL 120 MINUTE, t.fee=3*r.rate_per_hour, t.pay_method='UPI', t.status='PAID' WHERE t.plate_no='HR26DK4410'`);
}
app.post('/api/reset', wrap(async (req, res) => { await seedDemo(); res.json({ ok: true }); }));

const PORT = process.env.PORT || 3000;
(async () => {
  try {
    await pool.query('SELECT 1');
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM parking_ticket');
    if (!n) await seedDemo();
    app.listen(PORT, () => console.log('SmartPark running at http://localhost:' + PORT));
  } catch (e) {
    console.error('Cannot use MySQL. Did you run schema.sql and set your password in config.js?\n' + e.message);
    process.exit(1);
  }
})();
