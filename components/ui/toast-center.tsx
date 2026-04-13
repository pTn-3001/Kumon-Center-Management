"use client";

import { useEffect, useMemo, useState } from 'react';

type ToastKind = 'success' | 'error';

type ToastItem = {
  id: number;
  message: string;
  kind: ToastKind;
};

type ToastEventDetail = {
  message: string;
  kind?: ToastKind;
};

export function ToastCenter() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const custom = event as CustomEvent<ToastEventDetail>;
      const detail = custom.detail;
      if (!detail?.message) {
        return;
      }

      const id = Date.now() + Math.floor(Math.random() * 1000);
      const item: ToastItem = {
        id,
        message: detail.message,
        kind: detail.kind ?? 'success',
      };

      setToasts((current) => [...current, item]);

      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 2800);
    };

    window.addEventListener('app:toast', onToast as EventListener);
    return () => {
      window.removeEventListener('app:toast', onToast as EventListener);
    };
  }, []);

  const visibleToasts = useMemo(() => toasts.slice(-4), [toasts]);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {visibleToasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-xl border px-4 py-3 text-sm shadow-lg ${toast.kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
