import Layout from '@/components/Layout';
import MirImages from '@/components/MirImages';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function MirImagesPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <MirImages />
      </Layout>
    </ProtectedRoute>
  );
}