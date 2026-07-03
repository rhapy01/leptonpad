import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "@/lib/platformApi";
import { NOTIFICATIONS_QUERY_KEY } from "@/components/InAppNotificationProvider";

function typeLabel(type: string): string {
  switch (type) {
    case "unlock":
      return "Unlock";
    case "sale":
      return "Sale";
    case "follow":
      return "Follow";
    case "comment":
      return "Comment";
    case "reaction":
      return "Reaction";
    default:
      return "Update";
  }
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: () => void;
}) {
  const qc = useQueryClient();
  const markRead = useMutation({
    mutationFn: () => markNotificationRead(notification.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
  });

  const handleClick = () => {
    if (!notification.read) void markRead.mutate();
    onOpen();
  };

  return (
    <Link
      href={notification.link ?? "#"}
      onClick={handleClick}
      className="block px-4 py-3 border-b transition-colors hover:bg-[var(--color-hover-surface)]"
      style={{
        borderColor: "var(--color-border-muted)",
        opacity: notification.read ? 0.65 : 1,
      }}
    >
      <div className="flex items-start gap-2">
        {!notification.read && (
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ background: "var(--color-gold)" }}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-muted)" }}>
            {typeLabel(notification.type)}
          </p>
          <p className="text-sm leading-snug" style={{ color: "var(--color-ink)" }}>
            {notification.message}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-ink-muted)" }}>
            {new Date(notification.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: me } = useGetMe();

  const { data: notifications = [] } = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchNotifications,
    enabled: !!me,
    refetchInterval: 30_000,
  });

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
  });

  if (!me) return null;

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded p-1.5 transition-colors hover:bg-[var(--color-hover-surface)]"
        style={{ color: "var(--color-ink-muted)" }}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
            style={{ background: "var(--color-gold)", color: "#fff" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-md shadow-lg"
            style={{
              background: "var(--color-paper)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: "var(--color-border-muted)" }}
            >
              <span className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                Notifications
              </span>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead.mutate()}
                  className="text-xs font-medium"
                  style={{ color: "var(--color-gold)" }}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-ink-muted)" }}>
                  No notifications yet
                </p>
              ) : (
                notifications.map((n) => (
                  <NotificationRow key={n.id} notification={n} onOpen={() => setOpen(false)} />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
