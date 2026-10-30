"use client";

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ComponentType } from 'react';
import { LayoutDashboard, Megaphone, Printer, Users, BookOpen, Wallet, Settings, LibraryBig, Warehouse } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StaffRole } from '@/types';

type NavChild = {
  href: string;
  label: string;
  tab?: string;
  subtab?: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tab?: string;
  subtab?: string;
  children?: NavChild[];
};

const mainNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    href: '/hoc-vien',
    label: 'Học viên',
    icon: Users,
    children: [
      { href: '/hoc-vien?tab=hoc-vien', label: 'Chính thức', tab: 'hoc-vien' },
      { href: '/hoc-vien?tab=hoc-thu', label: 'Học thử', tab: 'hoc-thu' },
      { href: '/hoc-vien?tab=nghi-hoc', label: 'Nghỉ học', tab: 'nghi-hoc' },
      { href: '/hoc-vien?tab=sinh-nhat', label: 'Sinh nhật', tab: 'sinh-nhat' },
      { href: '/hoc-vien?tab=chua-thu-hoc-phi', label: 'Học phí', tab: 'chua-thu-hoc-phi' },
      { href: '/hoc-vien?tab=nhap-hoc', label: 'Nhập học', tab: 'nhap-hoc' },
    ],
  },
  {
    href: '/lop-hoc',
    label: 'Lớp học',
    icon: BookOpen,
    children: [
      { href: '/lop-hoc?tab=quan-ly', label: 'Quản lý lớp học', tab: 'quan-ly' },
      { href: '/lop-hoc?tab=lich-su', label: 'Lịch sử điểm danh', tab: 'lich-su' },
      { href: '/lop-hoc?tab=chuyen-can', label: 'Chấm điểm chuyên cần', tab: 'chuyen-can' },
    ],
  },
  {
    href: '/hoc-thuat',
    label: 'Học thuật',
    icon: LibraryBig,
    tab: 'hoc-thuat',
    children: [
      { href: '/hoc-thuat?tab=hoc-thuat&subtab=lich-hoc', label: 'Lịch học cá nhân', tab: 'hoc-thuat', subtab: 'lich-hoc' },
      { href: '/hoc-thuat?tab=hoc-thuat&subtab=soan-bai', label: 'Soạn bài', tab: 'hoc-thuat', subtab: 'soan-bai' },
    ],
  },
  {
    href: '/hoc-thuat',
    label: 'Kho',
    icon: Warehouse,
    tab: 'kho',
    children: [
      { href: '/hoc-thuat?tab=kho&ksubtab=nhap-kho', label: 'Nhập kho', tab: 'kho' },
      { href: '/hoc-thuat?tab=kho&ksubtab=ton-kho', label: 'Tồn kho', tab: 'kho' },
    ],
  },
  { href: '/tu-van', label: 'Tư vấn & CRM', icon: Megaphone },
  { href: '/tai-chinh', label: 'Tài chính', icon: Wallet },
  { href: '/in-giay-khen', label: 'In giấy khen', icon: Printer },
  { href: '/he-thong', label: 'Hệ thống', icon: Settings },
];

let cachedSidebarRole: StaffRole | null = null;

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab');
  const activeSubtab = searchParams.get('subtab');
  const activeKhoSubtab = searchParams.get('ksubtab');
  const [sessionRole, setSessionRole] = useState<StaffRole | null>(() => cachedSidebarRole);

  useEffect(() => {
    const loadSession = async () => {
      const response = await fetch('/api/auth/session', { cache: 'no-store' });
      if (!response.ok) return;

      const payload = (await response.json()) as { user?: { role?: StaffRole } };
      const role = payload.user?.role;
      if (role) {
        cachedSidebarRole = role;
        setSessionRole(role);
      }
    };

    void loadSession();
  }, []);

  const visibleNav = useMemo(() => {
    if (!sessionRole) {
      return [] as NavItem[];
    }

    if (sessionRole === 'Admin') {
      return mainNav;
    }

    if (sessionRole === 'Giáo viên' || sessionRole === 'Trợ giảng') {
      const allowed = new Set(['/hoc-vien', '/lop-hoc']);
      return mainNav.filter((item) => allowed.has(item.href) || (item.href === '/hoc-thuat' && item.tab === 'hoc-thuat'));
    }

    if (sessionRole === 'Tư vấn') {
      const allowed = new Set(['/tu-van', '/in-giay-khen', '/lop-hoc', '/hoc-vien']);
      return mainNav.filter((item) => allowed.has(item.href) || (item.href === '/hoc-thuat' && item.tab === 'kho'));
    }

    return [] as NavItem[];
  }, [sessionRole]);

  return (
    <aside className="flex h-screen flex-col border-r border-white/10 bg-slate-950 text-slate-100 md:sticky md:top-0">
      <div className="border-b border-white/10 px-4 py-5 lg:px-5 lg:py-6">
        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Image
            src="/images/logo_kumon.png"
            alt="Kumon Logo"
            width={44}
            height={44}
            className="rounded-2xl"
          />
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Kumon</p>
            <h1 className="display-font text-xl leading-tight text-white">Management</h1>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4 lg:px-4 lg:py-5">
        <div>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Chức năng chính</p>
          <div className="mt-3 space-y-1">
            {visibleNav.map((item) => {
              const active = item.tab
                ? pathname === item.href && activeTab === item.tab && (!item.subtab || activeSubtab === item.subtab)
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              const itemHref = item.children?.length
                ? item.children[0].href
                : (item.tab ? `${item.href}?tab=${item.tab}` : item.href);

              return (
                <div key={`${item.href}-${item.label}`} className="space-y-1">
                  <Link
                    href={itemHref}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all duration-150',
                      active
                        ? 'bg-kumon-500 text-white shadow-lg shadow-kumon-500/20'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>

                  {active && item.children?.length ? (
                    <div className="ml-6 space-y-1 border-l border-white/10 pl-3">
                      {item.children.map((child) => {
                        const childActive = pathname === item.href
                          && (child.tab ? child.tab === activeTab : true)
                          && (child.subtab ? child.subtab === activeSubtab : true)
                          && (child.tab !== 'kho' || !activeKhoSubtab || child.href.includes(`ksubtab=${activeKhoSubtab}`));
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              'block rounded-xl px-2 py-1.5 text-xs font-medium transition-all',
                              childActive
                                ? 'bg-white/15 text-white'
                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                            )}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </nav>
    </aside>
  );
}
