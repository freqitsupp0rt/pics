'use client';

import { AuthProvider } from '@/hooks/useAuth';

export default function AuthProviderWrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}