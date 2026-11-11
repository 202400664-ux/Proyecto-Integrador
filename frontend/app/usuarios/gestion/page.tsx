import RoleDashboard from '../../dashboard/RoleDashboard';
import UserForm from './UserForm';

export default function GestionUsuariosPage() {
  return (
    <RoleDashboard requierePermiso="usuarios.gestionar">
      <UserForm />
    </RoleDashboard>
  );
}
