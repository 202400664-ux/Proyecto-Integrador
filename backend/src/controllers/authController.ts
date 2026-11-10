import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Usuario } from '../models/Usuario.js';
import { Role, type IRole } from '../models/Role.js';
import { construirPayloadSesion } from '../services/permisos.js';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      res.status(400).json({ mensaje: 'Por favor ingrese correo y contraseña' });
      return;
    }

    const usuario = await Usuario.findOne({ email: email.trim().toLowerCase() })
      .select('+password')
      .populate<{ roles: IRole[] }>({ path: 'roles', model: Role });
    if (!usuario || usuario.activo === false || usuario.estado !== 'activo') {
      res.status(401).json({ mensaje: 'Credenciales inválidas' });
      return;
    }

    const esValida = await bcrypt.compare(password, usuario.password);
    if (!esValida) {
      res.status(401).json({ mensaje: 'Credenciales inválidas' });
      return;
    }

    const sesion = construirPayloadSesion(usuario);
    if (!sesion) {
      res.status(403).json({ mensaje: 'El usuario no tiene un rol activo asignado' });
      return;
    }

    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      res.status(500).json({ mensaje: 'JWT_SECRET no está configurado' });
      return;
    }

    if (usuario.mfaObligatorio) {
      const tempToken = jwt.sign(
        { id: usuario._id, type: 'MFA_TEMP' },
        secretKey,
        { expiresIn: '5m' }
      );
      res.status(200).json({
        mensaje: 'Se requiere completar la autenticación multifactor',
        mfaRequired: true,
        mfaSetupRequired: usuario.mfaObligatorio && !usuario.twoFactorEnabled,
        tempToken,
      });
      return;
    }

    const token = jwt.sign(
      sesion,
      secretKey,
      { expiresIn: '8h' }
    );

    res.status(200).json({
      mensaje: 'Inicio de sesión exitoso',
      token,
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ mensaje: 'Error interno en el servidor' });
  }
};