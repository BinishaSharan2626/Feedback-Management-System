const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the current directory
app.use(express.static(__dirname));

// Initialize SQLite database
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        db.serialize(() => {
            // Create feedbacks table if it doesn't exist
            db.run(`CREATE TABLE IF NOT EXISTS feedbacks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                eventId TEXT,
                attendeeName TEXT,
                rating INTEGER,
                comments TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            // Create events table if it doesn't exist
            db.run(`CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                title TEXT,
                date TEXT,
                desc TEXT,
                createdBy TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Create users table if it doesn't exist
            db.run(`CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT,
                role TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            // Seed default admin and manager
            db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin')`);
            db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('manager', 'manager123', 'manager')`);
        });
    }
});

// Authentication Routes
app.post('/api/signup', (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (row) return res.status(409).json({ error: 'Username already exists' });
        
        db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, [username, password, role], (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.status(201).json({ message: 'Signup successful' });
        });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    
    db.get(`SELECT * FROM users WHERE username = ? AND password = ? AND role = ?`, [username, password, role], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(401).json({ error: 'Invalid credentials or role' });
        
        res.json({ message: 'Login successful', user: { username: row.username, role: row.role } });
    });
});

// Task 2: Route that displays a welcome message
app.get('/api/welcome', (req, res) => {
    res.json({ message: 'Welcome to the EventFeed Backend API!' });
});

// Route to receive and save new events
app.post('/api/events', (req, res) => {
    const { id, title, date, desc, createdBy } = req.body;
    if (!id || !title || !date || !desc) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const sql = `INSERT INTO events (id, title, date, desc, createdBy) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [id, title, date, desc, createdBy], function(err) {
        if (err) {
            console.error('Error inserting event', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ message: 'Event created successfully' });
    });
});

// Route to get all events
app.get('/api/events', (req, res) => {
    db.all(`SELECT * FROM events ORDER BY createdAt DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ data: rows });
    });
});

// Route to get feedback for a specific manager's events
app.get('/api/feedback/manager/:username', (req, res) => {
    const username = req.params.username;
    const sql = `
        SELECT f.* FROM feedbacks f
        JOIN events e ON f.eventId = e.id
        WHERE e.createdBy = ?
        ORDER BY f.createdAt DESC
    `;
    db.all(sql, [username], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ data: rows });
    });
});

// Task 3: Route to receive feedback form data and save to database
app.post('/api/feedback', (req, res) => {
    const { eventName, attendeeName, rating, comments } = req.body;
    
    // Server-side validation
    if (!eventName || !rating || !comments) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const sql = `INSERT INTO feedbacks (eventId, attendeeName, rating, comments) VALUES (?, ?, ?, ?)`;
    const params = [eventName, attendeeName || 'Anonymous', rating, comments];
    
    db.run(sql, params, function(err) {
        if (err) {
            console.error('Error inserting feedback', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ 
            message: 'Feedback submitted successfully',
            id: this.lastID 
        });
    });
});

// Task 4: Retrieve all feedback
app.get('/api/feedback', (req, res) => {
    const sql = `SELECT * FROM feedbacks ORDER BY createdAt DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ data: rows });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
