"use client";

import { useEffect } from 'react';
import { ToastCenter } from '@/components/ui/toast-center';

function getActionVerb(method: string) {
  if (method === 'POST') return 'tạo';
  if (method === 'PATCH' || method === 'PUT') return 'cập nhật';
  if (method === 'DELETE') return 'xóa';
  return 'xử lý';
}

function getResourceLabel(pathname: string) {
  if (pathname.includes('/api/lop-hoc/attendance')) return 'điểm danh';
  if (pathname.includes('/api/lop-hoc')) return 'lớp học';
  if (pathname.includes('/api/hoc-vien/enrollments')) return 'ghi danh';
  if (pathname.includes('/api/hoc-vien')) return 'học viên';
  if (pathname.includes('/api/hoc-thuat/assessments')) return 'bài thi';
  if (pathname.includes('/api/hoc-thuat/worksheet-batches')) return 'nhập kho worksheet';
  if (pathname.includes('/api/hoc-thuat/worksheet-usages')) return 'sử dụng worksheet';
  if (pathname.includes('/api/hoc-thuat/personal-schedules')) return 'lịch học cá nhân';
  if (pathname.includes('/api/tu-van/appointments')) return 'lịch hẹn';
  if (pathname.includes('/api/tu-van')) return 'thông tin tư vấn';
  if (pathname.includes('/api/tai-chinh')) return 'phiếu tài chính';
  if (pathname.includes('/api/he-thong/staff')) return 'tài khoản nhân sự';
  if (pathname.includes('/api/auth/change-password')) return 'mật khẩu';
  if (pathname.includes('/api/auth/sign-in')) return 'đăng nhập';
  if (pathname.includes('/api/auth/sign-out')) return 'đăng xuất';
  return 'dữ liệu';
}

function buildToastMessage(method: string, pathname: string, ok: boolean) {
  const action = getActionVerb(method);
  const resource = getResourceLabel(pathname);
  return ok ? `Đã ${action} ${resource}.` : `Không thể ${action} ${resource}.`;
}

export function GlobalActionToast() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const isMutation = method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE';
      let response: Response;

      try {
        response = await originalFetch(input, init);
      } catch {
        if (isMutation) {
          window.dispatchEvent(new CustomEvent('app:toast', {
            detail: {
              message: 'Không thể kết nối máy chủ. Vui lòng thử lại.',
              kind: 'error',
            },
          }));
        }

        return new Response(JSON.stringify({ message: 'Network request failed' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (isMutation) {
        const rawUrl = typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
        const parsedUrl = new URL(rawUrl, window.location.origin);
        const pathname = parsedUrl.pathname;

        if (!pathname.includes('/api/auth/session')) {
          window.dispatchEvent(new CustomEvent('app:toast', {
            detail: {
              message: buildToastMessage(method, pathname, response.ok),
              kind: response.ok ? 'success' : 'error',
            },
          }));
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return <ToastCenter />;
}
