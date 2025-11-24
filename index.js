const express = require('express');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2');
const app = express();
const port = 3000;


const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    port: 3308,               
    password: 'Semogaditerima123', 
    database: 'apikey'        
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Berhasil terhubung ke database MySQL (apikey).');
});

// ==========================================
// 2. MIDDLEWARE & SETUP
// ==========================================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- INTEGRASI ROUTE ADMIN (DARI FILE TERPISAH) ---
// Pastikan file 'routes/admin.js' sudah ada
try {
    const adminRoutes = require('./routes/admin')(db);
    app.use(adminRoutes);
} catch (error) {
    console.error("Warning: File routes/admin.js tidak ditemukan atau error.", error.message);
}




app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Halaman Registrasi Admin -> http://localhost:3000/admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Halaman Dashboard Admin -> http://localhost:3000/dashboard
// (BAGIAN INI YANG SEBELUMNYA KURANG)
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});


// ==========================================
// 4. API ENDPOINTS (POST - AKSI)
// ==========================================

// --- A. MEMBUAT API KEY BARU ---
app.post('/create', (req, res) => {
    try {
        const randomBytes = crypto.randomBytes(32);
        const token = randomBytes.toString('base64url');
        const stamp = Date.now().toString();
        let apiKey = 'sk-co-vi-' + `${token}_${stamp}`;

        // Set kadaluwarsa 30 hari dari sekarang
        const date = new Date();
        date.setDate(date.getDate() + 30); 
        const outOfDate = date.toISOString().slice(0, 19).replace('T', ' ');

        const sqlQuery = 'INSERT INTO api_key (KeyValue, out_of_date) VALUES (?, ?)';

        db.query(sqlQuery, [apiKey, outOfDate], (err, results) => {
            if (err) {
                console.error('Gagal menyimpan API key:', err);
                return res.status(500).json({ error: 'Gagal menyimpan key di database' });
            }
            console.log(`Key baru: ${apiKey}, Expired: ${outOfDate}`);
            res.status(200).json({ apiKey: apiKey });
        });
    } catch (error) {
        console.error('Error crypto:', error);
        res.status(500).json({ error: 'Gagal membuat API key' });
    }
});

// --- B. CEK VALIDASI API KEY ---
app.post('/check', (req, res) => {
    const { apiKey } = req.body;

    if (!apiKey) return res.status(400).json({ error: 'API key wajib diisi' });

    const sqlQuery = 'SELECT * FROM api_key WHERE KeyValue = ?';

    db.query(sqlQuery, [apiKey], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Gagal memvalidasi key' });
        }

        if (results.length > 0) {
            const expiryDate = new Date(results[0].out_of_date);
            const now = new Date();

            if (now > expiryDate) {
                return res.status(401).json({ valid: false, message: 'API key sudah kedaluwarsa (expired)' });
            }
            res.status(200).json({ valid: true, message: 'API key valid dan aktif' });
        } else {
            res.status(401).json({ valid: false, message: 'API key tidak ditemukan' });
        }
    });
});

// --- C. REGISTRASI USER ---
app.post('/register/user', (req, res) => {
    const { first_name, last_name, email } = req.body;

    if (!first_name || !email) {
        return res.status(400).json({ error: 'Nama depan dan Email wajib diisi!' });
    }

    const sql = 'INSERT INTO user (first_name, last_name, email) VALUES (?, ?, ?)';
    
    db.query(sql, [first_name, last_name, email], (err, result) => {
        if (err) {
            console.error('Error User Register:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Email user sudah terdaftar!' });
            }
            return res.status(500).json({ error: 'Gagal mendaftarkan user.' });
        }
        res.status(200).json({ message: 'User berhasil didaftarkan!', userId: result.insertId });
    });
});


// ==========================================
// 5. API DATA UNTUK DASHBOARD (GET - DATA)
// ==========================================
// (BAGIAN INI YANG SEBELUMNYA KURANG)

// Ambil Semua Data User
app.get('/api/users', (req, res) => {
    db.query('SELECT id, first_name, last_name, email, created_at FROM user ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Ambil Semua Data Admin
app.get('/api/admins', (req, res) => {
    db.query('SELECT id, email, last_login FROM admin ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Ambil Semua Data API Key
app.get('/api/keys', (req, res) => {
    db.query('SELECT KeyValue, out_of_date FROM api_key ORDER BY out_of_date DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});


// ==========================================
// 6. JALANKAN SERVER
// ==========================================
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
    console.log(`Halaman Utama: http://localhost:${port}/`);
    console.log(`Halaman Admin: http://localhost:${port}/admin`);
    console.log(`Dashboard:     http://localhost:${port}/dashboard`);
});