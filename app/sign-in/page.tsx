"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, UserRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function SignInPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submitSignIn() {
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || 'Đăng nhập thất bại');
      }

      router.replace('/dashboard');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể đăng nhập');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dff2ff_0%,_#f9f7f1_55%,_#f1f8ff_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-5xl items-center justify-center">
        <Card className="w-full max-w-md border border-slate-200 bg-white/95 shadow-xl backdrop-blur">
          <CardHeader className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-kumon-700">Kumon Management</p>
            <CardTitle className="text-2xl">Đăng nhập hệ thống</CardTitle>
            <p className="text-sm text-muted-foreground">Phiên đăng nhập được duy trì 24 giờ.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input value={username} onChange={(event) => setUsername(event.target.value)} className="pl-10" placeholder="Nhập username" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mật khẩu</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="pl-10" placeholder="Nhập mật khẩu" />
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button className="w-full" disabled={loading} onClick={() => void submitSignIn()}>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
