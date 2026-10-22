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
import GatewaysPanel from './components/GatewaysPanel';
import DashboardKpis from './components/DashboardKpis';

type Pestana = 'inicio' | 'proveedores' | 'pedidos' | 'caseta' | 'gateways' | 'mantenimientos' | 'auditoria' | 'kpis' | 'parametros';

/**
 * Panel único de Proveedores/Pedidos/Caseta para TODOS los roles.
 *
 * No hay una interfaz distinta por rol: es el mismo componente para
 * administrador, coordinador y operador. Lo único que cambia es qué
 * ACCIONES puede ejecutar cada uno (crear proveedor, crear pedido, marcar arribos),
 * controlado centralmente en `permisos.ts` a través de `useRol().puede(...)`.
 */
export default function GestionPanel() {
  const { puede, rol } = useRol();
  const [pestana, setPestana] = useState<Pestana>(() => rol === 'coordinador' ? 'gateways' : 'inicio');

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedoresTabla, setProveedoresTabla] = useState<Proveedor[]>([]);
  const [cargandoProveedores, setCargandoProveedores] = useState(true);
  const [categoriaProveedor, setCategoriaProveedor] = useState('');

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(true);

  const [errorCarga, setErrorCarga] = useState('');
  const [mensajeProveedor, setMensajeProveedor] = useState('');
  const [proveedorEditar, setProveedorEditar] = useState<Proveedor | null>(null);
  const [pedidoEditar, setPedidoEditar] = useState<Pedido | null>(null);
  const [mensajePedido, setMensajePedido] = useState('');
  const [limpiarMensajePedido, setLimpiarMensajePedido] = useState(0);

  const navegarA = (destino: Exclude<Pestana, 'inicio'>) => {
    window.dispatchEvent(new CustomEvent('dashboard:select-tab', { detail: destino }));
  };

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
        setProveedoresTabla(listaProveedores);
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
    if (!categoriaProveedor) return;

    let activo = true;
    const cargarProveedores = async () => {
      setCargandoProveedores(true);
      try {
        const lista = await obtenerProveedores(categoriaProveedor as Proveedor['categoria']);
        if (activo) setProveedoresTabla(lista);
      } catch (error) {
        if (activo) setErrorCarga(error instanceof Error ? error.message : 'No se pudieron cargar los proveedores');
      } finally {
        if (activo) setCargandoProveedores(false);
      }
    };

    void cargarProveedores();
    return () => {
      activo = false;
    };
  }, [categoriaProveedor, proveedores]);

  useEffect(() => {
    const onShowHome = () => setPestana('inicio');
    const onSelectTab = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail && ['inicio', 'proveedores', 'pedidos', 'caseta', 'gateways', 'parametros', 'mantenimientos', 'auditoria', 'kpis'].includes(detail)) {
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
        <section className="welcome-panel dashboard-home">
          <div className="dashboard-home-header">
            <div>
              <p className="dashboard-home-kicker">Centro de distribución</p>
              <h2>Resumen operativo</h2>
            </div>
          </div>
          <div className="row g-3">
            <div className="col-md-4">
              <button type="button" className="dashboard-home-tile" onClick={() => navegarA('proveedores')}>
                <span>Proveedores activos</span>
                <strong>{proveedores.length}</strong>
                <small>Administrar proveedores</small>
              </button>
            </div>
            <div className="col-md-4">
              <button type="button" className="dashboard-home-tile" onClick={() => navegarA('pedidos')}>
                <span>Pedidos en agenda</span>
                <strong>{pedidos.length}</strong>
                <small>Ver programación</small>
              </button>
            </div>
            <div className="col-md-4">
              <button type="button" className="dashboard-home-tile" onClick={() => navegarA('caseta')}>
                <span>Arribos por registrar</span>
                <strong>{pedidos.filter((pedido) => pedido.estado === 'PROGRAMADO').length}</strong>
                <small>Abrir caseta</small>
              </button>
            </div>
          </div>
        </section>
      )}

      {pestana === 'proveedores' && (
        <>
          {puede('proveedores.crear') && (
            <ProveedorForm
              key={proveedorEditar?._id ?? 'nuevo'}
              proveedorEditar={proveedorEditar}
              onResultado={setMensajeProveedor}
              onCancelarEdicion={() => setProveedorEditar(null)}
              onProveedorActualizado={(actualizado) => {
                setProveedores((prev) => prev.map((item) => item._id === actualizado._id ? actualizado : item));
                setProveedoresTabla((prev) => prev.flatMap((item) => {
                  if (item._id !== actualizado._id) return [item];
                  return !categoriaProveedor || actualizado.categoria === categoriaProveedor ? [actualizado] : [];
                }));
                setProveedorEditar(null);
              }}
              onProveedorCreado={(nuevo) => {
                setProveedores((prev) => [...prev, nuevo].sort((a, b) => a.razonSocial.localeCompare(b.razonSocial)));
                if (!categoriaProveedor || nuevo.categoria === categoriaProveedor) {
                  setProveedoresTabla((prev) => [...prev, nuevo].sort((a, b) => a.razonSocial.localeCompare(b.razonSocial)));
                }
              }}
            />
          )}
          {mensajeProveedor && <div className="alert alert-success" role="status">{mensajeProveedor}</div>}
          <ProveedoresTable
            proveedores={categoriaProveedor ? proveedoresTabla : proveedores}
            cargando={cargandoProveedores}
            categoriaFiltro={categoriaProveedor}
            puedeEditar={puede('proveedores.editar')}
            puedeInactivar={puede('proveedores.inactivar')}
            onCategoriaFiltroChange={(categoria) => {
              setCategoriaProveedor(categoria);
              if (!categoria) setCargandoProveedores(false);
            }}
            onEditar={(proveedor) => {
              setMensajeProveedor('');
              setProveedorEditar(proveedor);
            }}
            onInactivar={async (id) => {
              if (!window.confirm('¿Inactivar este proveedor?')) return;
              try {
                const proveedor = proveedores.find((item) => item._id === id);
                await inactivarProveedor(id);
                setProveedores((prev) => prev.filter((item) => item._id !== id));
                setProveedoresTabla((prev) => prev.filter((item) => item._id !== id));
                setProveedorEditar((actual) => actual?._id === id ? null : actual);
                setMensajeProveedor(`Proveedor "${proveedor?.razonSocial ?? id}" inactivado correctamente.`);
              } catch (error) {
                setErrorCarga(error instanceof Error ? error.message : 'No se pudo inactivar el proveedor');
              }
            }}
          />
        </>
      )}

      {pestana === 'pedidos' && (
        <>
          {mensajePedido && <div className="alert alert-success" role="status">{mensajePedido}</div>}
          {puede('pedidos.crear') && (
            <PedidoForm
              key={`${pedidoEditar?._id ?? 'nuevo'}-${limpiarMensajePedido}`}
              proveedores={proveedores}
              pedidoEditar={pedidoEditar}
              onCancelarEdicion={() => setPedidoEditar(null)}
              onPedidoActualizado={(actualizado) => {
                setPedidos((prev) => prev.map((item) => item._id === actualizado._id ? actualizado : item));
                setPedidoEditar(null);
                setMensajePedido('');
              }}
              onPedidoCreado={(nuevo) =>
                {
                  setMensajePedido('');
                  setPedidos((prev) => [...prev, nuevo].sort(
                    (a, b) => new Date(a.inicioVentana).getTime() - new Date(b.inicioVentana).getTime()
                  ));
                }
              }
            />
          )}
          <PedidosTable
            pedidos={pedidos}
            proveedores={proveedores}
            cargando={cargandoPedidos}
            puedeEditar={puede('pedidos.editar')}
            puedeCancelar={puede('pedidos.cancelar')}
            onEditar={setPedidoEditar}
            onCancelar={async (id) => {
              if (!window.confirm('¿Cancelar este pedido? Se conservará en la base de datos, pero dejará de aparecer en el tablero.')) return;
              try {
                const pedidoCancelado = pedidos.find((item) => item._id === id);
                await cancelarPedido(id);
                setPedidos(await obtenerPedidos());
                setMensajePedido(
                  `Pedido "${pedidoCancelado?.numeroPedido || ''}" eliminado de la lista. El registro se conservó en la base de datos.`
                );
                setLimpiarMensajePedido((prev) => prev + 1);
                setPedidoEditar(null);
                setErrorCarga('');
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

      {pestana === 'gateways' && puede('gateways.ver') && (
        <GatewaysPanel
          puedeAdministrar={puede('gateways.admin')}
          puedeOperar={puede('descargas.operar')}
        />
      )}

      {pestana === 'parametros' && puede('parametros.ver') && <ParametrosPanel puedeGestionar={puede('parametros.editar')} />}

      {pestana === 'mantenimientos' && <MantenimientosPanel />}

      {pestana === 'auditoria' && puede('auditoria.ver') && <AuditoriaPanel />}

      {pestana === 'kpis' && puede('dashboard.kpis') && <DashboardKpis />}
    </div>
  );
}