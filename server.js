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

// --- 1. MÓDULO DE USUARIOS Y AUTENTICACIÓN ---

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

// Registro: Nueva Empresa
app.post('/api/registro-empresa', (req, res) => {
    const { nombre_empresa, usuario, correo, password, cedula, telefono } = req.body;
    
    db.query("INSERT INTO empresas (nombre) VALUES (?)", [nombre_empresa], (err, result) => {
        if (err) return res.status(500).json({ status: 'error', message: "Error Empresas: " + err.sqlMessage });
        
        const empresaId = result.insertId;
        const sqlUser = "INSERT INTO usuarios (usuario, correo, password, empresa_id, rol, cedula, telefono) VALUES (?, ?, ?, ?, 'Admin', ?, ?)";
        
        db.query(sqlUser, [usuario, correo, password, empresaId, cedula, telefono], (err2) => {
            if (err2) return res.status(500).json({ status: 'error', message: "Error Usuarios: " + err2.sqlMessage });
            res.json({ status: 'success', message: 'Registro completo' });
        });
    });
});

// Registro: Unirme a Empresa (Solución a error de columna "nombre")
app.post('/api/unirme-empresa', (req, res) => {
    const { nombre_empresa, usuario, correo, password, cedula, telefono } = req.body;

    // MEJORA: Busca en 'nombre' o 'nombre_empresa' para evitar fallos de esquema
    const sqlBusqueda = "SELECT id FROM empresas WHERE nombre = ? OR nombre_empresa = ?";

    db.query(sqlBusqueda, [nombre_empresa, nombre_empresa], (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: "Error búsqueda: " + err.sqlMessage });
        if (rows.length === 0) return res.status(404).json({ status: 'error', message: "La empresa no existe." });

        const empresaId = rows[0].id;
        // 'Tecnico' se envía corto para evitar el error de "Data truncated"
        const sqlUser = "INSERT INTO usuarios (usuario, correo, password, empresa_id, rol, cedula, telefono) VALUES (?, ?, ?, ?, 'Tecnico', ?, ?)";
        
        db.query(sqlUser, [usuario, correo, password, empresaId, cedula, telefono], (err2) => {
            if (err2) return res.status(500).json({ status: 'error', message: "Error al registrarse: " + err2.sqlMessage });
            res.json({ status: 'success', message: 'Unido exitosamente' });
        });
    });
});

// --- 2. MÓDULO DE REGISTRO TÉCNICO ---

app.post('/api', (req, res) => {
    const { cedula_cliente, nombre_cliente, empresa_id, nombre_equipo, tipo_servicio, descripcion, foto_inicial } = req.body;
    const fotoBuffer = foto_inicial ? Buffer.from(foto_inicial, 'base64') : null;

    // MEJORA: Se eliminó 'cliente_id' de la consulta para evitar el error de "no default value"
    const sql = `INSERT INTO servicios_equipos 
                (nombre_cliente, cedula_cliente, empresa_id, nombre_equipo, tipo_servicio, descripcion, foto_inicial, estatus) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente')`;

    db.query(sql, [nombre_cliente, cedula_cliente, empresa_id || 1, nombre_equipo, tipo_servicio, descripcion, fotoBuffer], (err, result) => {
        if (err) {
            // Este error ocurre si no has creado las columnas en Railway
            console.error("❌ Error DB:", err.sqlMessage);
            return res.status(500).json({ status: 'error', message: `Error DB: ${err.sqlMessage}` });
        }
        res.json({ status: 'success', message: 'Equipo registrado', id: result.insertId });
    });
});

// --- 3. MÓDULO DE CONSULTAS Y ACTUALIZACIÓN ---

app.get('/api/servicios', (req, res) => {
    db.query("SELECT * FROM servicios_equipos ORDER BY id DESC", (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        const data = rows.map(row => ({
            ...row,
            foto_inicial: row.foto_inicial ? row.foto_inicial.toString('base64') : null,
            foto_actual: row.foto_actual ? row.foto_actual.toString('base64') : null
        }));
        res.json(data);
    });
});

app.get('/api/usuarios/empresa/:id', (req, res) => {
    db.query("SELECT id, usuario, correo, rol FROM usuarios WHERE empresa_id = ?", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json(rows);
    });
});

app.get('/api/productos', (req, res) => {
    db.query("SELECT * FROM productos_almacen ORDER BY nombre ASC", (err, rows) => {
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
    console.log(`🚀 Servidor Servitec Cloud activo en puerto: ${PORT}`);
});
