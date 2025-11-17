const express = require('express');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2');
const app = express();
const port = 3000;

// ==========================================
// 1. KONFIGURASI KONEKSI DATABASE
// ==========================================
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    port: 3308,               // Port MySQL Anda
    password: 'Semogaditerima123', // Password Database Anda
    database: 'apikey'        // Nama Database
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
// Untuk membaca JSON dari body request
app.use(express.json());
// Untuk melayani file statis (css, js, gambar) dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- INTEGRASI ROUTE ADMIN (DARI FILE TERPISAH) ---
// Pastikan Anda sudah membuat file: routes/admin.js
const adminRoutes = require('./routes/admin')(db);
app.use(adminRoutes);


// ==========================================
// 3. ROUTE HALAMAN WEB (HTML)
// ==========================================

// Halaman Utama (User & API Key) -> http://localhost:3000/
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Halaman Khusus Admin -> http://localhost:3000/admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});


// ==========================================
// 4. API ENDPOINTS
// ==========================================

// --- A. MEMBUAT API KEY BARU (Tabel: api_key) ---
app.post('/create', (req, res) => {
    try {
        // 1. Generate Key Unik
        const randomBytes = crypto.randomBytes(32);
        const token = randomBytes.toString('base64url');
        const stamp = Date.now().toString();
        let apiKey = 'sk-co-vi-' + `${token}_${stamp}`;

        // 2. Hitung Tanggal Kedaluwarsa (30 Hari dari sekarang)
        const date = new Date();
        date.setDate(date.getDate() + 30); 
        // Format ke MySQL DATETIME: YYYY-MM-DD HH:MM:SS
        const outOfDate = date.toISOString().slice(0, 19).replace('T', ' ');

        // 3. Simpan ke Database
        const sqlQuery = 'INSERT INTO api_key (KeyValue, out_of_date) VALUES (?, ?)';

        db.query(sqlQuery, [apiKey, outOfDate], (err, results) => {
            if (err) {
                console.error('Gagal menyimpan API key:', err);
                return res.status(500).json({ error: 'Gagal menyimpan key di database' });
            }
            
            console.log(`Key baru dibuat: ${apiKey}, Expired: ${outOfDate}`);
            res.status(200).json({ apiKey: apiKey });
        });

    } catch (error) {
        console.error('Error crypto:', error);
        res.status(500).json({ error: 'Gagal membuat API key' });
    }
});

// --- B. CEK VALIDASI API KEY (Tabel: api_key) ---
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
            // Key Ditemukan, Cek Kedaluwarsa
            const expiryDate = new Date(results[0].out_of_date);
            const now = new Date();

            if (now > expiryDate) {
                return res.status(401).json({ valid: false, message: 'API key sudah kedaluwarsa (expired)' });
            }

            res.status(200).json({ valid: true, message: 'API key valid dan aktif' });
        } else {
            // Key Tidak Ditemukan
            res.status(401).json({ valid: false, message: 'API key tidak ditemukan' });
        }
    });
});

// --- C. REGISTRASI USER (Tabel: user) ---
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

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
    
});