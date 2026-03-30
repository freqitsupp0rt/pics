import Layout from '@/components/Layout';
import MonthlyInspectionReport from '@/components/MonthlyInspectionReport';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function MirPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <MonthlyInspectionReport />
      </Layout>
    </ProtectedRoute>
  );
}