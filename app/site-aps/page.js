import Layout from '@/components/Layout';
import SiteDevices from '@/components/SiteDevices';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function SiteDevicesPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <SiteDevices />
      </Layout>
    </ProtectedRoute>
  );
}