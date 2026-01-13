const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

// --- CONFIGURACIÓN DE SEGURIDAD Y TAMAÑO DE DATOS ---
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- CONEXIÓN A MYSQL (RAILWAY) ---
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

// Verificar conexión inicial
db.getConnection((err, conn) => {
    if (err) {
        console.error('❌ Error crítico de conexión a la DB:', err.message);
    } else {
        console.log('✅ Conexión exitosa a la base de datos en Railway');
        conn.release();
    }
});

// --- 1. MÓDULO DE USUARIOS ---

// Login
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

// NUEVO: Obtener usuarios por Empresa (Para la vista de equipo en Flutter)
app.get('/api/usuarios/empresa/:empresaId', (req, res) => {
    const { empresaId } = req.params;
    const sql = "SELECT id, usuario, correo, rol FROM usuarios WHERE empresa_id = ?";
    
    db.query(sql, [empresaId], (err, rows) => {
        if (err) {
            console.error("❌ Error al obtener compañeros:", err);
            return res.status(500).json({ status: 'error', message: err.message });
        }
        res.json(rows);
    });
});

// --- 2. MÓDULO DE REGISTRO TÉCNICO (POST /api) ---
app.post('/api', (req, res) => {
    console.log("📩 Recibiendo nuevo reporte de Flutter...");
    
    const { 
        cedula_cliente, 
        nombre_cliente, 
        empresa_id, 
        nombre_equipo, 
        tipo_servicio, 
        descripcion, 
        foto_inicial 
    } = req.body;

    const fotoBuffer = foto_inicial ? Buffer.from(foto_inicial, 'base64') : null;

    // Se asume que la tabla se llama servicios_equipos. 
    // Si el error de "Unknown column" persiste, verifica los nombres exactos en tu DB.
    const sql = `INSERT INTO servicios_equipos 
                (nombre_cliente, cedula_cliente, empresa_id, nombre_equipo, tipo_servicio, descripcion, foto_inicial, estatus) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente')`;

    db.query(sql, [
        nombre_cliente, 
        cedula_cliente, 
        empresa_id || 1, 
        nombre_equipo, 
        tipo_servicio, 
        descripcion, 
        fotoBuffer
    ], (err, result) => {
        if (err) {
            console.error("❌ ERROR EN INSERT:", err.sqlMessage);
            return res.status(500).json({ 
                status: 'error', 
                message: `Error en DB: ${err.sqlMessage}.` 
            });
        }
        res.json({ status: 'success', message: 'Reporte guardado', id: result.insertId });
    });
});

// --- 3. MÓDULO DE ACTUALIZACIÓN DE ESTATUS ---
app.put('/api/actualizar-estatus', (req, res) => {
    const { id, estatus } = req.body;
    const sql = "UPDATE servicios_equipos SET estatus = ? WHERE id = ?";
    
    db.query(sql, [estatus, id], (err, result) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', message: 'Estatus actualizado' });
    });
});

// --- 4. LISTADO DE SERVICIOS (GET) ---
app.get('/api/servicios', (req, res) => {
    const sql = `SELECT * FROM servicios_equipos ORDER BY id DESC`; 
    db.query(sql, (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        const data = rows.map(row => ({
            ...row,
            foto_inicial: row.foto_inicial ? row.foto_inicial.toString('base64') : null,
            foto_actual: row.foto_actual ? row.foto_actual.toString('base64') : null
        }));
        res.json(data);
    });
});

// --- 5. MÓDULO DE ALMACÉN ---
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

// --- LANZAMIENTO ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor activo en puerto: ${PORT}`);
});

