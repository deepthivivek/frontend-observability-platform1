import { Suspense } from 'react';
import { DashboardContainer } from '@/src/components/dashboard/DashboardContainer';

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <DashboardContainer />
    </Suspense>
  );
}
