const express = require('express');
const sql = require('mssql');

const cors = require('cors');

const app = express();
app.use(cors({
  origin: '*' // permite cualquier origen por ahora
}));

app.use(express.json());

// const config = {
//   server: 'mariana-sql-server01.database.windows.net',
//   port: 1433,
//   database: 'free-sql-db-9012390',
//   user: 'adminT',
//   password: 'T_v134Mtz',
//   options: {
//     //trustedConnection: true,
//     trustServerCertificate: true
//   }
// };


//configuracion para conexion con render
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,           
    trustServerCertificate: false
  }
}

// const config = {
//   server: '127.0.0.1',
//   port: 1433,
//   database: 'TallerV1',
//   user: 'destruc16x',
//   password: 'Bg1234',
//   options: {
//     //trustedConnection: true,
//     trustServerCertificate: true
//   }
// };


// Prueba de conexión
app.get('/api/ping', async (req, res) => {
  try {
    await sql.connect(config);
    res.json({ ok: true, mensaje: 'Conectado a SQL Server ✅' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});

// ══ LOGIN ══
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    await sql.connect(config);
    const result = await sql.query`
      SELECT u.IdUsuario, u.Username, u.IdRol, u.Activo,
             COALESCE(e.Nombre, c.Nombre) AS _nombre,
             COALESCE(e.Telefono, c.Telefono) AS Telefono,
             COALESCE(e.Correo, c.Correo) AS Correo,
             e.IdEmpleado, e.Puesto,
             c.IdCliente, c.Direccion
      FROM Usuarios u
      LEFT JOIN Empleados e ON u.IdUsuario = e.IdUsuario
      LEFT JOIN Clientes  c ON u.IdUsuario = c.IdUsuario
      WHERE u.Username = ${username} AND u.Password = ${password} AND u.Activo = 1`;
    if (result.recordset.length === 0)
      return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos' });
    res.json({ ok: true, usuario: result.recordset[0] });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// ══ REGISTER ══

app.post('/api/register', async (req, res) => {
  const { nombre, telefono, correo, direccion, username, password } = req.body;
  try {
    await sql.connect(config);

    const existe = await sql.query`SELECT IdUsuario FROM Usuarios WHERE Username = ${username}`;
    if (existe.recordset.length > 0)
      return res.status(400).json({ ok: false, error: 'Ese username ya existe' });

    const uResult = await sql.query`
      INSERT INTO Usuarios (Username, Password, IdRol, Activo)
      OUTPUT INSERTED.IdUsuario
      VALUES (${username}, ${password}, 3, 1)`;
    const idUsuario = uResult.recordset[0].IdUsuario;

    await sql.query`
      INSERT INTO Clientes (IdUsuario, Nombre, Telefono, Correo, Direccion)
      VALUES (${idUsuario}, ${nombre}, ${telefono}, ${correo}, ${direccion})`;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

//nuevo endpoint para registrar solo cliente  (login - dashboard)

app.post('/api/nuevo-cliente', async (req, res) => {

  const { Nombre, Telefono, Correo, Direccion, Username, Password, IdRol } = req.body;

  try {
    await sql.connect(config);


    const existe = await sql.query`SELECT IdUsuario FROM Usuarios WHERE Username = ${Username}`;
    if (existe.recordset.length > 0) {
      return res.status(400).json({ ok: false, error: 'El nombre de usuario ya existe' });
    }


    const uResult = await sql.query`
      INSERT INTO Usuarios (Username, Password, IdRol, Activo)
      OUTPUT INSERTED.IdUsuario
      VALUES (${Username}, ${Password}, ${IdRol}, 1)`;
    
    const idUsuario = uResult.recordset[0].IdUsuario;


    await sql.query`
      INSERT INTO Clientes (IdUsuario, Nombre, Telefono, Correo, Direccion)
      VALUES (${idUsuario}, ${Nombre}, ${Telefono}, ${Correo}, ${Direccion})`;

    res.json({ ok: true, mensaje: 'Registro completado con éxito' });

  } catch (err) {
    console.error("Error en registro:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});


// ══ ROLES ══
app.get('/api/roles', async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query`SELECT * FROM Roles`;
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══ EMPLEADOS ══
//obtener empleados con su info de usuario
app.get('/api/empleados', async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query`

      SELECT 
        e.IdEmpleado, e.IdUsuario, e.Nombre, e.Telefono, e.Correo, e.Puesto,
        u.Username, u.IdRol, u.Activo
      FROM Empleados e
      JOIN Usuarios u ON e.IdUsuario = u.IdUsuario`;

    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

//crear o actualizar empleado
app.post('/api/empleados', async (req, res) => {
  const { IdEmpleado, IdUsuario, nombre, telefono, correo, puesto, username, password, IdRol, Activo } = req.body;
  try {
    await sql.connect(config);
    if (IdEmpleado) {
      await sql.query`UPDATE Usuarios SET Username=${username}, IdRol=${IdRol}, Activo=${Activo} WHERE IdUsuario=${IdUsuario}`;
      await sql.query`UPDATE Empleados SET Nombre=${nombre}, Telefono=${telefono}, Correo=${correo}, Puesto=${puesto} WHERE IdEmpleado=${IdEmpleado}`;
    } else {
      const existe = await sql.query`SELECT IdUsuario FROM Usuarios WHERE Username=${username}`;
      if (existe.recordset.length > 0) return res.status(400).json({ ok: false, error: 'Username ya existe' });
      const uResult = await sql.query`
        INSERT INTO Usuarios (Username, Password, IdRol, Activo)
        OUTPUT INSERTED.IdUsuario VALUES (${username}, ${password}, ${IdRol}, ${Activo})`;
      const idUsuario = uResult.recordset[0].IdUsuario;
      await sql.query`INSERT INTO Empleados (IdUsuario, Nombre, Telefono, Correo, Puesto) VALUES (${idUsuario}, ${nombre}, ${telefono}, ${correo}, ${puesto})`;
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Desactivar/reactivar empleado en cascada
app.put('/api/empleados/:id', async (req, res) => {
  try {
    await sql.connect(config);
    const { Activo } = req.body;

    // Obtener el IdUsuario del empleado
    const emp = await sql.query`SELECT IdUsuario FROM Empleados WHERE IdEmpleado=${req.params.id}`;
    const idUsuario = emp.recordset[0].IdUsuario;

    // Actualizar estado en ambas tablas
    await sql.query`UPDATE Empleados SET Activo=${Activo} WHERE IdEmpleado=${req.params.id}`;
    await sql.query`UPDATE Usuarios SET Activo=${Activo} WHERE IdUsuario=${idUsuario}`;

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


//eliminar empleado de forma definitiva junto a su usuario asociado
app.delete('/api/empleados/:id', async (req, res) => {
  try {
    await sql.connect(config);
    const emp = await sql.query`SELECT IdUsuario FROM Empleados WHERE IdEmpleado=${req.params.id}`;
    const idUsuario = emp.recordset[0].IdUsuario;
    await sql.query`DELETE FROM Empleados WHERE IdEmpleado=${req.params.id}`;
    await sql.query`DELETE FROM Usuarios WHERE IdUsuario=${idUsuario}`;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══ CLIENTES ══
//obtener clientes
app.get('/api/clientes', async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query`
      SELECT c.*, u.Username, u.Activo
      FROM Clientes c
      JOIN Usuarios u ON c.IdUsuario = u.IdUsuario`;
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

//crear o actualizar cliente
app.post('/api/clientes', async (req, res) => {
  const { IdCliente, IdUsuario, nombre, telefono, correo, direccion, username, password, Activo } = req.body;
  try {
    await sql.connect(config);
    if (IdCliente) {
      await sql.query`UPDATE Usuarios SET Username=${username}, Activo=${Activo} WHERE IdUsuario=${IdUsuario}`;
      await sql.query`UPDATE Clientes SET Nombre=${nombre}, Telefono=${telefono}, Correo=${correo}, Direccion=${direccion} WHERE IdCliente=${IdCliente}`;
    } else {
      const existe = await sql.query`SELECT IdUsuario FROM Usuarios WHERE Username=${username}`;
      if (existe.recordset.length > 0) return res.status(400).json({ ok: false, error: 'Username ya existe' });
      const uResult = await sql.query`
        INSERT INTO Usuarios (Username, Password, IdRol, Activo)
        OUTPUT INSERTED.IdUsuario VALUES (${username}, ${password}, 3, ${Activo})`;
      const idUsuario = uResult.recordset[0].IdUsuario;
      await sql.query`INSERT INTO Clientes (IdUsuario, Nombre, Telefono, Correo, Direccion) VALUES (${idUsuario}, ${nombre}, ${telefono}, ${correo}, ${direccion})`;
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});
//eliminar cliente (borrado lógico, se mantiene en BD pero se marca como inactivo)
app.delete('/api/clientes/:id', async (req, res) => {
  try {
    await sql.connect(config);
    const cli = await sql.query`SELECT IdUsuario FROM Clientes WHERE IdCliente=${req.params.id}`;
    const idUsuario = cli.recordset[0].IdUsuario;
    await sql.query`DELETE FROM Clientes WHERE IdCliente=${req.params.id}`;
    await sql.query`DELETE FROM Usuarios WHERE IdUsuario=${idUsuario}`;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══ CATÁLOGO ══

//obtener catálogo completo
app.get('/api/catalogo', async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query`SELECT * FROM Catalogo`;
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

//crear o actualizar producto
app.post('/api/catalogo', async (req, res) => {
  const { IdProducto, Nombre, Descripcion, Precio, Imagen, Activo } = req.body;
  try {
    await sql.connect(config);
    if (IdProducto) {
      await sql.query`UPDATE Catalogo SET Nombre=${Nombre}, 
                      Descripcion=${Descripcion}, 
                      Precio=${Precio}, 
                      Imagen=${Imagen}, 
                      Activo=${1} 
                      WHERE IdProducto=${IdProducto}`;
    } else {
      await sql.query`INSERT INTO Catalogo (Nombre, Descripcion, Precio, Imagen, Activo) VALUES (${Nombre}, ${Descripcion}, ${Precio}, ${Imagen}, ${Activo})`;
    }
    res.json({ ok: true });

  } catch (err) { 
      res.status(500).json({ error: err.message }); 
    }
});
//eliminar producto 
app.delete('/api/catalogo/:id', async (req, res) => {
  try {
    await sql.connect(config);
    await sql.query`DELETE FROM Catalogo WHERE IdProducto=${req.params.id}`;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══ ORDENES ══
app.get('/api/ordenes', async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query`SELECT * FROM Ordenes ORDER BY IdOrden DESC`;
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
//crear orden con detalle (items)
app.post('/api/ordenes', async (req, res) => {
  const { IdCliente, Tipo, items } = req.body;
  try {
    await sql.connect(config);
    const ordenResult = await sql.query`
      INSERT INTO Ordenes (IdCliente, Tipo, Estado)
      OUTPUT INSERTED.IdOrden
      VALUES (${IdCliente}, ${Tipo}, 'Pendiente')`;
    const idOrden = ordenResult.recordset[0].IdOrden;
    for (const item of items) {
      await sql.query`INSERT INTO DetalleOrden (IdOrden, IdProducto, Cantidad, Precio) VALUES (${idOrden}, ${item.IdProducto}, ${item.Cantidad}, ${item.Precio})`;
    }
    res.json({ ok: true, IdOrden: idOrden });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
//actualizar estado de orden
app.patch('/api/ordenes/:id', async (req, res) => {
  const { Estado } = req.body;
  try {
    await sql.connect(config);
    await sql.query`UPDATE Ordenes SET Estado=${Estado} WHERE IdOrden=${req.params.id}`;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══ DETALLE ORDENES ══
//obtener detalle de una orden
app.get('/api/detalle-ordenes', async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query`SELECT * FROM DetalleOrden`;
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══ VEHÍCULOS ══
//obtener vehículos
app.get('/api/vehiculos', async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query`SELECT * FROM Vehiculos`;
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══ PAGOS ══
//obtener pagos
app.get('/api/pagos', async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query`SELECT * FROM Pagos`;
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});





app.listen(3000, () => console.log('Servidor corriendo en http://localhost:3000'));