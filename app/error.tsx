'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">页面出错了</h2>
        <p className="text-sm text-slate-500 mb-6">
          发生了意外错误，请尝试刷新页面。如果问题持续，请联系支持。
        </p>
        {error.message && (
          <p className="text-xs text-red-500 bg-red-50 p-2 rounded mb-4 break-all">
            {error.message}
          </p>
        )}
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          重新加载
        </button>
      </div>
    </div>
  );
}
