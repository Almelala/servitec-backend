const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

// --- CONFIGURACIÓN DE SEGURIDAD ---
// Se permite cualquier origen para evitar errores de CORS en dispositivos móviles
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- CONEXIÓN A MYSQL (VINCULADA A TU RAILWAY) ---
const db = mysql.createPool({
    host: 'crossover.proxy.rlwy.net',
    user: 'root', 
    password: 'JCJjxRWAZGuspsJTiSwseQUyRSlBIuRb', 
    database: 'railway', 
    port: 56271,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Verificar conexión al iniciar
db.getConnection((err, conn) => {
    if (err) {
        console.error('❌ Error conectando a la base de datos de Railway:', err.message);
    } else {
        console.log('✅ Conexión exitosa a la base de datos en Railway');
        conn.release();
    }
});

// --- 1. MÓDULO DE USUARIOS ---

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const sql = "SELECT id, usuario, correo, empresa_id, rol FROM usuarios WHERE correo = ? AND password = ?";
    db.query(sql, [email, password], (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        if (rows.length > 0) {
            res.json({ status: 'success', user: rows[0] });
        } else {
            res.status(401).json({ status: 'error', message: 'Correo o contraseña incorrectos' });
        }
    });
});

app.post('/api/registro-empresa', (req, res) => {
    const { nombre_empresa, usuario, cedula, telefono, correo, password } = req.body;
    db.getConnection((err, conn) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        conn.beginTransaction(err => {
            if (err) { conn.release(); return res.status(500).send(); }
            conn.query("INSERT INTO empresas (nombre_empresa) VALUES (?)", [nombre_empresa], (err, result) => {
                if (err) return conn.rollback(() => { conn.release(); res.status(400).json({ status: 'error', message: 'Empresa ya existe' }); });
                const empresa_id = result.insertId;
                conn.query("INSERT INTO usuarios (usuario, cedula, telefono, correo, password, empresa_id, rol) VALUES (?, ?, ?, ?, ?, ?, 'admin')", 
                [usuario, cedula, telefono, correo, password, empresa_id], (err2) => {
                    if (err2) return conn.rollback(() => { conn.release(); res.status(500).json({ status: 'error', message: 'Error en registro' }); });
                    conn.commit(err3 => {
                        conn.release();
                        res.json({ status: 'success', message: 'Registrados' });
                    });
                });
            });
        });
    });
});

// --- 2. MÓDULO DE ALMACÉN ---

app.get('/api/productos', (req, res) => {
    const sql = "SELECT * FROM productos_almacen ORDER BY nombre ASC";
    db.query(sql, (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        const data = rows.map(row => ({
            ...row,
            foto: row.foto_url ? row.foto_url.toString('base64') : null
        }));
        res.json(data);
    });
});

app.post('/api/productos', (req, res) => {
    const { nombre, precio_dolar, cantidad, foto, empresa_id } = req.body;
    const fotoBuffer = foto ? Buffer.from(foto, 'base64') : null;
    const sql = `INSERT INTO productos_almacen (empresa_id, nombre, precio_dolar, cantidad, foto_url) VALUES (?, ?, ?, ?, ?)`;
    db.query(sql, [empresa_id || 1, nombre, precio_dolar, cantidad, fotoBuffer], (err, result) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', id: result.insertId });
    });
});

// --- LANZAMIENTO (MEJORADO PARA RAILWAY) ---
// process.env.PORT es fundamental para que Railway asigne su puerto automáticamente
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor activo en puerto: ${PORT}`);
});