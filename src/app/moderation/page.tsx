"use client";

import { useEffect, useMemo, useState } from 'react';
import { CommentumApi, ModerationReport } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert, Trash2, UserMinus, CheckCircle2, Search, RefreshCw, AlertCircle, EyeOff, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ModerationPage() {
  const { role } = useAuth();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [banUserId, setBanUserId] = useState('');

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const data = await CommentumApi.listReports(100, 0);
      setReports(data.reports || []);
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'admin' || role === 'moderator') fetchQueue();
  }, [role]);

  const filtered = useMemo(() => {
    if (!search) return reports;
    const q = search.toLowerCase();
    return reports.filter((r) => [r.comment_content, r.comment_author, r.reporter, r.reason].join(' ').toLowerCase().includes(q));
  }, [reports, search]);

  const handleAction = async (id: string, action: 'hidden' | 'removed' | 'active') => {
    try {
      await CommentumApi.setCommentStatus(id, action);
      toast.success(`Comment ${action}`);
      setReports((prev) => prev.filter((r) => r.comment_id !== id));
    } catch {
      toast.error('Action failed');
    }
  };

  const handleBan = async () => {
    if (!banUserId.trim()) return;
    try {
      const res = await CommentumApi.banUser(banUserId.trim());
      toast.success(res.message);
      setBanUserId('');
    } catch {
      toast.error('Ban failed. Confirm user id and role permissions.');
    }
  };

  if (role !== 'admin' && role !== 'moderator') {
    return <div className="flex h-screen items-center justify-center">Access denied</div>;
  }

  return (
    <div className="min-h-screen bg-muted/40 pb-20">
      <div className="sticky top-0 z-30 w-full bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">Moderation Queue</span>
            <Badge variant="secondary" className="ml-2 rounded-full px-2.5">{reports.length}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-64 hidden sm:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search reports..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-muted/50 border-none" />
            </div>
            <Button variant="ghost" size="icon" onClick={fetchQueue} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto max-w-5xl p-4 space-y-6 mt-6">
        {role === 'admin' && (
          <Card>
            <CardHeader className="font-semibold">Admin Actions</CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Input placeholder="User UUID to ban" value={banUserId} onChange={(e) => setBanUserId(e.target.value)} className="max-w-md" />
              <Button onClick={handleBan}><UserMinus className="mr-2 h-4 w-4" />Ban User</Button>
            </CardContent>
          </Card>
        )}

        {loading && reports.length === 0 ? (
          <div className="flex items-center justify-center py-20"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 space-y-3"><CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />No pending reports.</div>
        ) : (
          filtered.map((report) => (
            <Card key={report.id}>
              <CardHeader className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <span>Reason: <strong>{report.reason}</strong></span>
                  <span>Reporter: @{report.reporter}</span>
                  <span>Author: @{report.comment_author}</span>
                  <span className="text-muted-foreground">{new Date(report.created_at).toLocaleString()}</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{report.comment_content}</p>
                <p className="text-xs text-muted-foreground mt-2">Current status: {report.comment_status}</p>
              </CardContent>
              <CardFooter className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => handleAction(report.comment_id, 'active')}><Eye className="mr-2 h-4 w-4" />Keep Active</Button>
                <Button variant="outline" size="sm" onClick={() => handleAction(report.comment_id, 'hidden')}><EyeOff className="mr-2 h-4 w-4" />Hide</Button>
                <Button variant="destructive" size="sm" onClick={() => handleAction(report.comment_id, 'removed')}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>
              </CardFooter>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
