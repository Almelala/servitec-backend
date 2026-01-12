const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

// --- CONFIGURACIÓN DE SEGURIDAD ---
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- CONEXIÓN A MYSQL ---
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

db.getConnection((err, conn) => {
    if (err) {
        console.error('❌ Error conectando a la base de datos:', err.message);
    } else {
        console.log('✅ Conexión exitosa a Railway');
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

// --- 2. MÓDULO DE REGISTRO (RUTA QUE USA TU APP DE FLUTTER) ---
app.post('/api', (req, res) => {
    const { 
        cedula_cliente, 
        nombre_cliente, 
        empresa_id, 
        nombre_equipo, 
        tipo_servicio, 
        descripcion, 
        foto_inicial 
    } = req.body;

    // Convertir la imagen base64 de Flutter a Buffer para MySQL
    const fotoBuffer = foto_inicial ? Buffer.from(foto_inicial, 'base64') : null;

    // Ajustamos las columnas según la estructura de tu tabla servicios_equipos
    const sql = `INSERT INTO servicios_equipos 
                (nombre_cliente, cedula_cliente, empresa_id, nombre_equipo, tipo_servicio, descripcion, foto_inicial) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.query(sql, [nombre_cliente, cedula_cliente, empresa_id || 1, nombre_equipo, tipo_servicio, descripcion, fotoBuffer], (err, result) => {
        if (err) {
            console.error("❌ Error al insertar reporte:", err.message);
            return res.status(500).json({ status: 'error', message: err.message });
        }
        res.json({ status: 'success', message: 'Reporte guardado exitosamente', id: result.insertId });
    });
});

// --- 3. MÓDULO DE ALMACÉN ---
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

// --- 4. LISTADO DE SERVICIOS (GET) ---
app.get('/api/servicios', (req, res) => {
    const sql = `SELECT * FROM servicios_equipos ORDER BY id DESC`; 
    db.query(sql, (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        const data = rows.map(row => ({
            ...row,
            foto_inicial: row.foto_inicial ? row.foto_inicial.toString('base64') : null
        }));
        res.json(data);
    });
});

// --- LANZAMIENTO ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor activo en puerto: ${PORT}`);
});
