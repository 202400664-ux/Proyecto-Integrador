import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Usuario } from '../models/Usuario.js';
import { Role, type IRole, type RoleName } from '../models/Role.js';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // 1. Validar campos requeridos
    if (!email || !password) {
      res.status(400).json({ mensaje: 'Por favor ingrese correo y contraseña' });
      return;
    }

    // 2. Buscar usuario en MongoDB
    const usuario = await Usuario.findOne({ email, estado: 'activo' })
      .populate<{ roles: IRole[] }>({ path: 'roles', model: Role });
    if (!usuario) {
      res.status(401).json({ mensaje: 'Credenciales inválidas' });
      return;
    }

    // 3. Comparar contraseña con el hash de la BD
    const esValida = await bcrypt.compare(password, usuario.password);
    if (!esValida) {
      res.status(401).json({ mensaje: 'Credenciales inválidas' });
      return;
    }

    const rolesPermitidos: RoleName[] = ['administrador', 'coordinador', 'operador'];
    const rol = usuario.roles.find((role) => rolesPermitidos.includes(role.nombre));
    if (!rol) {
      res.status(403).json({ mensaje: 'El rol del usuario no es válido' });
      return;
    }

    // 4. Firmar Token JWT con expiración de 24 horas y ROL (RBAC)
    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      res.status(500).json({ mensaje: 'JWT_SECRET no está configurado' });
      return;
    }

    const token = jwt.sign(
      { id: usuario._id, email: usuario.email, rol: rol.nombre },
      secretKey,
      { expiresIn: '24h' } // Expiración exacta a 24 horas
    );

    // 5. Enviar respuesta con el ÚNICO token. El rol y el resto de datos del
    // usuario viven exclusivamente dentro del JWT (fuente única de verdad):
    // no se duplica el rol fuera del token para evitar inconsistencias.
    res.status(200).json({
      mensaje: 'Inicio de sesión exitoso',
      token,
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno en el servidor', error });
  }
};