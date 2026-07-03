import { useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchNotifications, type Notification } from "@/lib/platformApi";
import { useToast } from "@/hooks/use-toast";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

function notificationToastTitle(type: string): string {
  switch (type) {
    case "unlock":
      return "Content unlocked";
    case "sale":
      return "New sale";
    case "follow":
      return "New subscriber";
    case "comment":
      return "New comment";
    case "reaction":
      return "New reaction";
    default:
      return "Notification";
  }
}

export function InAppNotificationProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const seenIds = useRef(new Set<number>());
  const initialized = useRef(false);

  const { data: notifications = [] } = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchNotifications,
    enabled: !!isSignedIn,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!isSignedIn) {
      seenIds.current.clear();
      initialized.current = false;
      return;
    }

    if (!initialized.current) {
      for (const n of notifications) seenIds.current.add(n.id);
      initialized.current = true;
      return;
    }

    for (const n of notifications) {
      if (n.read || seenIds.current.has(n.id)) continue;
      seenIds.current.add(n.id);
      toast({
        title: notificationToastTitle(n.type),
        description: n.message,
        duration: 8000,
      });
    }
  }, [notifications, isSignedIn, toast]);

  useEffect(() => {
    if (!isSignedIn) qc.removeQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
  }, [isSignedIn, qc]);

  return <>{children}</>;
}

export function useNotificationsList(): Notification[] {
  const { data = [] } = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
  });
  return data;
}
