const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Kita mengekspor fungsi yang menerima koneksi 'db'
module.exports = (db) => {

    // Pindahkan endpoint '/register/admin' ke sini
    router.post('/register/admin', (req, res) => {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email dan Password wajib diisi!' });
        }

        // Hash password (SHA-256)
        const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

        const sql = 'INSERT INTO admin (email, password_hash) VALUES (?, ?)';

        db.query(sql, [email, passwordHash], (err, result) => {
            if (err) {
                console.error('Error Admin Register:', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'Email admin sudah terdaftar!' });
                }
                return res.status(500).json({ error: 'Gagal mendaftarkan admin.' });
            }
            res.status(200).json({ message: 'Admin berhasil didaftarkan!', adminId: result.insertId });
        });
    });

    return router;
};