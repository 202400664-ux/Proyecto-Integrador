import RoleDashboard from '../../dashboard/RoleDashboard';
import RolesAdmin from './RolesAdmin';

export default function CatalogoRolesPage() {
  return (
    <RoleDashboard requierePermiso="roles.gestionar">
      <RolesAdmin />
    </RoleDashboard>
  );
}
