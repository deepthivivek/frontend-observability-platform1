'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AuthPortal } from '@/src/components/auth/AuthPortal';

function LoginRouteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reason = searchParams.get('reason');

  return (
    <AuthPortal
      initialReason={reason}
      onAuthenticated={() => {
        router.push('/');
      }}
      onWorkspaceSwitched={() => {
        router.push('/');
      }}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <LoginRouteContent />
    </Suspense>
  );
}
