import Layout from '@/components/Layout';
import ManualDataManager from '@/components/ManualDataManager';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function ManualDataManagerPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <ManualDataManager />
      </Layout>
    </ProtectedRoute>
  );
}