'use client';

import { useEffect, useState } from 'react';
import { useRol } from '../RolContext';
import { obtenerPedidos, obtenerProveedores } from './api';
import type { Pedido, Proveedor } from './types';
import ProveedorForm from './components/ProveedorForm';
import ProveedoresTable from './components/ProveedoresTable';
import PedidoForm from './components/PedidoForm';
import PedidosTable from './components/PedidosTable';

type Pestana = 'proveedores' | 'pedidos';

/**
 * Panel único de Proveedores/Pedidos para TODOS los roles.
 *
 * No hay una interfaz distinta por rol: es el mismo componente para
 * administrador, coordinador y operador. Lo único que cambia es qué
 * ACCIONES puede ejecutar cada uno (crear proveedor, crear pedido),
 * controlado centralmente en `permisos.ts` a través de `useRol().puede(...)`.
 */
export default function GestionPanel() {
  const { puede } = useRol();
  const [pestana, setPestana] = useState<Pestana>('proveedores');

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargandoProveedores, setCargandoProveedores] = useState(true);

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(true);

  const [errorCarga, setErrorCarga] = useState('');

  useEffect(() => {
    let activo = true;

    const cargarDatos = async () => {
      try {
        const [listaProveedores, listaPedidos] = await Promise.all([
          obtenerProveedores(),
          obtenerPedidos(),
        ]);
        if (!activo) return;
        setProveedores(listaProveedores);
        setPedidos(listaPedidos);
      } catch {
        if (!activo) return;
        setErrorCarga(
          'No se pudo conectar con el servidor backend (http://localhost:4000). Verifique que esté corriendo.'
        );
      } finally {
        if (!activo) return;
        setCargandoProveedores(false);
        setCargandoPedidos(false);
      }
    };

    cargarDatos();
    return () => {
      activo = false;
    };
  }, []);

  return (
    <div>
      {errorCarga && <div className="alert alert-danger">{errorCarga}</div>}

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${pestana === 'proveedores' ? 'active' : ''}`}
            onClick={() => setPestana('proveedores')}
          >
            Proveedores
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${pestana === 'pedidos' ? 'active' : ''}`}
            onClick={() => setPestana('pedidos')}
          >
            Pedidos
          </button>
        </li>
      </ul>

      {pestana === 'proveedores' && (
        <>
          {/* La acción de CREAR solo se muestra si el rol actual tiene el permiso.
              El rol que no puede crear igual ve la tabla, en modo consulta. */}
          {puede('proveedores.crear') && (
            <ProveedorForm
              onProveedorCreado={(nuevo) =>
                setProveedores((prev) =>
                  [...prev, nuevo].sort((a, b) => a.razonSocial.localeCompare(b.razonSocial))
                )
              }
            />
          )}
          <ProveedoresTable proveedores={proveedores} cargando={cargandoProveedores} />
        </>
      )}

      {pestana === 'pedidos' && (
        <>
          {puede('pedidos.crear') && (
            <PedidoForm
              proveedores={proveedores}
              onPedidoCreado={(nuevo) =>
                setPedidos((prev) =>
                  [...prev, nuevo].sort(
                    (a, b) => new Date(a.inicioVentana).getTime() - new Date(b.inicioVentana).getTime()
                  )
                )
              }
            />
          )}
          <PedidosTable pedidos={pedidos} proveedores={proveedores} cargando={cargandoPedidos} />
        </>
      )}
    </div>
  );
}