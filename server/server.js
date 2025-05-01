require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'reefscape_teams',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Create teams table if not exists
async function initializeDatabase() {
    const conn = await pool.getConnection();
    await conn.query(`
        CREATE TABLE IF NOT EXISTS teams (
            id INT AUTO_INCREMENT PRIMARY KEY,
            number VARCHAR(10) NOT NULL UNIQUE,
            name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    conn.release();
}

// API Routes
app.get('/api/teams', async (req, res) => {
    try {
        const [teams] = await pool.query('SELECT number, name FROM teams ORDER BY number');
        res.json(teams);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/teams', async (req, res) => {
    const { number, name } = req.body;
    if (!number || !name) {
        return res.status(400).json({ error: 'Team number and name are required' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO teams (number, name) VALUES (?, ?)',
            [number, name]
        );
        res.status(201).json({ id: result.insertId, number, name });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Team number already exists' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.get('/api/teams/search', async (req, res) => {
    const term = req.query.term;
    if (!term) {
        return res.json([]);
    }

    try {
        const [teams] = await pool.query(
            'SELECT number, name FROM teams WHERE number LIKE ? OR name LIKE ? ORDER BY number',
            [`%${term}%`, `%${term}%`]
        );
        res.json(teams);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Initialize and start server
initializeDatabase().then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
