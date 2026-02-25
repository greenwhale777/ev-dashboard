'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OliveyoungDBRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/ev2');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <p className="text-gray-500 text-sm">/ev2 페이지로 이동 중...</p>
    </div>
  );
}
