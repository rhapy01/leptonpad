import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { fetchNotifications, markAllNotificationsRead } from "@/lib/platformApi";

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: me } = useGetMe();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    enabled: !!me,
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (!me) return null;

  const unread = notifications.filter(n => !n.read).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="relative p-1.5 rounded"
        style={{ color: "#78716C" }}
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: "#C8960C", color: "#fff" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 w-80 z-50 rounded shadow-lg overflow-hidden"
            style={{ background: "#ffffff", border: "1px solid rgba(28,25,23,0.12)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(28,25,23,0.1)" }}>
              <span className="text-sm font-semibold" style={{ color: "#1C1917" }}>Notifications</span>
              {unread > 0 && (
                <button type="button" onClick={() => markRead.mutate()} className="text-xs" style={{ color: "#C8960C" }}>
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-sm text-center" style={{ color: "#78716C" }}>No notifications yet</p>
              ) : (
                notifications.map(n => (
                  <Link
                    key={n.id}
                    href={n.link ?? "#"}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 border-b transition-colors hover:bg-black/[0.03]"
                    style={{ borderColor: "rgba(28,25,23,0.06)", opacity: n.read ? 0.6 : 1 }}
                  >
                    <p className="text-sm" style={{ color: "#1C1917" }}>{n.message}</p>
                    <p className="text-xs mt-1" style={{ color: "#A8A29E" }}>
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
