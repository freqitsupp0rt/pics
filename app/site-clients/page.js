import Layout from '@/components/Layout';
import SiteClients from '@/components/SiteClients';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function SiteClientsPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <SiteClients />
      </Layout>
    </ProtectedRoute>
  );
}