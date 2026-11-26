// Edit these values to match your MySQL installation
module.exports = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'OmeshVerma',
  database: process.env.DB_NAME || 'smartpark'
};
