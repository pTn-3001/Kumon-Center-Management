"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Bell, CalendarDays, LogOut } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, formatDate } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export function AppShell({ children, title = 'Dashboard', subtitle = 'Quản lý trung tâm Kumon' }: AppShellProps) {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<{ fullName: string; role: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: number; title: string; message: string; createdAt: string; read: boolean }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const loadNotifications = useCallback(async () => {
    const response = await fetch('/api/notifications', { cache: 'no-store' });
    if (!response.ok) {
      console.warn('Failed to load notifications', response.status);
      return;
    }

    const payload = (await response.json()) as {
      unreadCount: number;
      items: Array<{ id: number; title: string; message: string; createdAt: string; read: boolean }>;
    };
    setUnreadCount(payload.unreadCount);
    setNotifications(payload.items);
  }, []);

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '??';
    const first = parts[0][0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
    return `${last}${first}`.toUpperCase();
  };

  useEffect(() => {
    const loadSession = async () => {
      const response = await fetch('/api/auth/session', { cache: 'no-store' });
      if (!response.ok) {
        setSessionUser(null);
        return;
      }

      const payload = (await response.json()) as { user?: { fullName: string; role: string } };
      setSessionUser(payload.user ?? null);
    };

    void loadSession();
  }, []);

  useEffect(() => {
    void loadNotifications();
    const timer = setInterval(() => {
      void loadNotifications();
    }, 10000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!notificationsOpen) return;
      if (!notificationsRef.current) return;
      if (notificationsRef.current.contains(event.target as Node)) return;
      setNotificationsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!menuOpen) return;
      if (!userMenuRef.current) return;
      if (userMenuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [menuOpen]);

  const markNotificationsRead = async () => {
    const response = await fetch('/api/notifications', { method: 'PATCH' });
    if (!response.ok) return;
    setUnreadCount(0);
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  };

  const signOut = async () => {
    await fetch('/api/auth/sign-out', { method: 'POST' });
    router.replace('/sign-in');
    router.refresh();
  };

  const submitPasswordChange = async () => {
    setPasswordError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || 'Không thể đổi mật khẩu');
      }

      setPasswordDialogOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMenuOpen(false);
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Không thể đổi mật khẩu');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="grid min-h-screen md:grid-cols-[244px_1fr] xl:grid-cols-[244px_1fr]">
      <Suspense fallback={<aside className="hidden md:block" />}>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-white/60 bg-[rgba(249,247,241,0.9)] backdrop-blur-xl">
          <div className="page-wrap flex flex-col gap-4 px-4 py-4 md:px-5 lg:flex-row lg:items-center lg:justify-between xl:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-kumon-700">Kumon Management</p>
              <h2 className="display-font mt-1 text-2xl text-slate-950 md:text-3xl">{title}</h2>
              <p className="mt-1 text-sm text-slate-600 md:text-[15px]">{subtitle}</p>
            </div>
            <div className="flex items-center gap-3 self-start xl:self-auto">
              <div className="hidden items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm text-slate-600 shadow-sm lg:flex">
                <CalendarDays className="h-4 w-4 text-kumon-600" />
                {formatDate(new Date())}
              </div>
              <div ref={notificationsRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    void loadNotifications();
                    setNotificationsOpen((current) => !current);
                    if (unreadCount > 0) {
                      void markNotificationsRead();
                    }
                  }}
                  className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null}
                </button>

                {notificationsOpen ? (
                  <div className="absolute right-0 mt-2 w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                    <div className="border-b px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">Thông báo</p>
                    </div>
                    <div className="max-h-[360px] space-y-2 overflow-y-auto p-2">
                      {notifications.map((item) => (
                        <div key={item.id} className={cn('rounded-xl border p-3 text-sm', item.read ? 'bg-white' : 'bg-slate-50')}>
                          <p className="font-medium text-slate-900">{item.title}</p>
                          <p className="mt-1 text-slate-600">{item.message}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString('vi-VN', { hour12: false })}</p>
                        </div>
                      ))}
                      {notifications.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Chưa có thông báo.</p> : null}
                    </div>
                  </div>
                ) : null}
              </div>
              <div ref={userMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((current) => !current)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-950 text-sm font-semibold text-white shadow-sm"
                >
                  {sessionUser ? getInitials(sessionUser.fullName) : '--'}
                </button>

                {menuOpen ? (
                  <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                    <div className="border-b px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{sessionUser?.fullName ?? 'Đang tải...'}</p>
                      <p className="text-xs text-muted-foreground">{sessionUser?.role ?? ''}</p>
                    </div>
                    <div className="p-2">
                      <button
                        type="button"
                        onClick={() => setPasswordDialogOpen(true)}
                        className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                      >
                        Đổi mật khẩu
                      </button>
                      <button
                        type="button"
                        onClick={() => void signOut()}
                        className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        <LogOut className="inline h-4 w-4 mr-2" />
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>
        <main className={cn('page-wrap min-w-0 flex-1 px-4 py-5 md:px-5 lg:px-6 xl:py-7')}>{children}</main>
        </div>

        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Đổi mật khẩu</DialogTitle>
              <DialogDescription>Cập nhật mật khẩu đăng nhập tài khoản hiện tại.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Mật khẩu hiện tại</Label>
                <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Mật khẩu mới</Label>
                <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Xác nhận mật khẩu mới</Label>
                <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </div>
              {passwordError ? <p className="text-sm text-destructive">{passwordError}</p> : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)}>Hủy</Button>
              <Button type="button" disabled={savingPassword} onClick={() => void submitPasswordChange()}>
                {savingPassword ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
              </Button>
            </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
