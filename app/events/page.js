import Layout from '@/components/Layout';
import Events from '@/components/Events';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function EventsPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <Events />
      </Layout>
    </ProtectedRoute>
  );
}