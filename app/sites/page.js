import Layout from '@/components/Layout';
import Sites from '@/components/Sites';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function SitesPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <Sites />
      </Layout>
    </ProtectedRoute>
  );
}