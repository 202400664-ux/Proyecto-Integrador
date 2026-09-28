'use client';

import { useEffect, useState } from 'react';
import { useRol } from '../RolContext';
import { cancelarPedido, inactivarProveedor, obtenerPedidos, obtenerProveedores } from './api';
import type { Pedido, Proveedor } from './types';
import ProveedorForm from './components/ProveedorForm';
import ProveedoresTable from './components/ProveedoresTable';
import PedidoForm from './components/PedidoForm';
import PedidosTable from './components/PedidosTable';
import CasetaArribosForm from './components/CasetaArribosForm';
import MantenimientosPanel from './components/MantenimientosPanel';
import AuditoriaPanel from './components/AuditoriaPanel';
import ParametrosPanel from './components/ParametrosPanel';

type Pestana = 'inicio' | 'proveedores' | 'pedidos' | 'caseta' | 'mantenimientos' | 'auditoria' | 'parametros';

/**
 * Panel único de Proveedores/Pedidos/Caseta para TODOS los roles.
 *
 * No hay una interfaz distinta por rol: es el mismo componente para
 * administrador, coordinador y operador. Lo único que cambia es qué
 * ACCIONES puede ejecutar cada uno (crear proveedor, crear pedido, marcar arribos),
 * controlado centralmente en `permisos.ts` a través de `useRol().puede(...)`.
 */
export default function GestionPanel() {
  const { puede } = useRol();
  const [pestana, setPestana] = useState<Pestana>('inicio');

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargandoProveedores, setCargandoProveedores] = useState(true);

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(true);

  const [errorCarga, setErrorCarga] = useState('');
  const [proveedorEditar, setProveedorEditar] = useState<Proveedor | null>(null);
  const [pedidoEditar, setPedidoEditar] = useState<Pedido | null>(null);

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

  useEffect(() => {
    const onShowHome = () => setPestana('inicio');
    const onSelectTab = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail && ['inicio', 'proveedores', 'pedidos', 'caseta', 'parametros', 'mantenimientos', 'auditoria'].includes(detail)) {
        setPestana(detail as Pestana);
      }
    };

    window.addEventListener('dashboard:show-home', onShowHome);
    window.addEventListener('dashboard:select-tab', onSelectTab as EventListener);

    return () => {
      window.removeEventListener('dashboard:show-home', onShowHome);
      window.removeEventListener('dashboard:select-tab', onSelectTab as EventListener);
    };
  }, []);

  return (
    <div>
      {errorCarga && <div className="alert alert-danger">{errorCarga}</div>}

      {pestana === 'inicio' && (
        <div className="welcome-panel card p-4 shadow-sm border-0">
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
            <div>
              <p className="text-uppercase mb-2 fw-bold" style={{ letterSpacing: '0.14em', color: '#F1BD4B' }}>Panel principal</p>
              <h2 className="mb-0" style={{ color: '#123149' }}>Bienvenido al sistema</h2>
            </div>
            <span className="badge bg-light text-primary px-3 py-2">Dashboard operativo</span>
          </div>
          <div className="row g-3">
            <div className="col-md-4">
              <div className="card h-100 border-0 bg-light">
                <div className="card-body">
                  <h3 className="h6 fw-bold text-primary">Proveedores</h3>
                  <p className="mb-0 text-secondary">Administra altas, estados y contacto de proveedores.</p>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100 border-0 bg-light">
                <div className="card-body">
                  <h3 className="h6 fw-bold text-primary">Pedidos</h3>
                  <p className="mb-0 text-secondary">Programación de ventanas, traslapes y alternativas.</p>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100 border-0 bg-light">
                <div className="card-body">
                  <h3 className="h6 fw-bold text-primary">Caseta</h3>
                  <p className="mb-0 text-secondary">Registro de arribos y clasificación por tolerancia.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {pestana === 'proveedores' && (
        <>
          {puede('proveedores.crear') && (
            <ProveedorForm
              proveedorEditar={proveedorEditar}
              onCancelarEdicion={() => setProveedorEditar(null)}
              onProveedorActualizado={(actualizado) => {
                setProveedores((prev) => prev.map((item) => item._id === actualizado._id ? actualizado : item));
                setProveedorEditar(null);
              }}
              onProveedorCreado={(nuevo) =>
                setProveedores((prev) =>
                  [...prev, nuevo].sort((a, b) => a.razonSocial.localeCompare(b.razonSocial))
                )
              }
            />
          )}
          <ProveedoresTable
            proveedores={proveedores}
            cargando={cargandoProveedores}
            onEditar={setProveedorEditar}
            onInactivar={async (id) => {
              if (!window.confirm('¿Inactivar este proveedor?')) return;
              try {
                await inactivarProveedor(id);
                setProveedores((prev) => prev.filter((item) => item._id !== id));
              } catch (error) {
                setErrorCarga(error instanceof Error ? error.message : 'No se pudo inactivar el proveedor');
              }
            }}
          />
        </>
      )}

      {pestana === 'pedidos' && (
        <>
          {puede('pedidos.crear') && (
            <PedidoForm
              proveedores={proveedores}
              pedidoEditar={pedidoEditar}
              onCancelarEdicion={() => setPedidoEditar(null)}
              onPedidoActualizado={(actualizado) => {
                setPedidos((prev) => prev.map((item) => item._id === actualizado._id ? actualizado : item));
                setPedidoEditar(null);
              }}
              onPedidoCreado={(nuevo) =>
                setPedidos((prev) =>
                  [...prev, nuevo].sort(
                    (a, b) => new Date(a.inicioVentana).getTime() - new Date(b.inicioVentana).getTime()
                  )
                )
              }
            />
          )}
          <PedidosTable
            pedidos={pedidos}
            proveedores={proveedores}
            cargando={cargandoPedidos}
            onEditar={setPedidoEditar}
            onCancelar={async (id) => {
              if (!window.confirm('¿Cancelar este pedido? Se conservará en la base de datos, pero dejará de aparecer en el tablero.')) return;
              try {
                await cancelarPedido(id);
                setPedidos(await obtenerPedidos());
              } catch (error) {
                setErrorCarga(error instanceof Error ? error.message : 'No se pudo cancelar el pedido');
              }
            }}
          />
        </>
      )}

      {/* 👈 4. Contenido renderizado para Caseta de Arribos */}
      {pestana === 'caseta' && (
        <CasetaArribosForm
          onArriboRegistrado={async () => {
            try {
              const listaPedidos = await obtenerPedidos();
              setPedidos(listaPedidos);
            } catch (err) {
              console.error('Error al actualizar pedidos tras arribo:', err);
            }
          }}
        />
      )}

      {pestana === 'parametros' && puede('parametros.ver') && <ParametrosPanel puedeGestionar={puede('parametros.editar')} />}

      {pestana === 'mantenimientos' && <MantenimientosPanel />}

      {pestana === 'auditoria' && <AuditoriaPanel />}
    </div>
  );
}