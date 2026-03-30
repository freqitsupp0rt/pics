import Layout from '@/components/Layout';
import Generate from '@/components/Generate';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function GeneratePage() {
  return (
    <ProtectedRoute>
      <Layout>
        <Generate />
      </Layout>
    </ProtectedRoute>
  );
}