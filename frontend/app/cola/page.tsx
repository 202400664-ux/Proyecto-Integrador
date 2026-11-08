import RoleDashboard from '../dashboard/RoleDashboard';
import ColaTablero from './ColaTablero';

export default function ColaEsperaPage() {
  return (
    <RoleDashboard requierePermiso="cola.ver">
      <ColaTablero />
    </RoleDashboard>
  );
}
