import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import {
  fetchComments,
  postComment,
  fetchReactions,
  toggleReaction,
  fetchCollections,
  saveToCollection,
  reportContent,
  type Comment,
} from "@/lib/platformApi";
import { CreatorName } from "@/components/CreatorName";
import { useToast } from "@/hooks/use-toast";

function CommentItem({
  comment,
  onReply,
}: {
  comment: Comment;
  onReply: (parentId: number) => void;
}) {
  return (
    <div className="flex gap-3">
      {comment.userImageUrl ? (
        <img src={comment.userImageUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
      ) : (
        <div className="engagement-avatar-fallback w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs">
          {comment.userName[0]}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="engagement-name text-xs font-medium">
          <CreatorName name={comment.userName} verified={comment.userVerified} size="sm" />
        </p>
        <p className="engagement-body text-sm mt-1" style={{ fontFamily: "'Lora', Georgia, serif", lineHeight: 1.6 }}>
          {comment.body}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <p className="engagement-muted text-xs">
            {new Date(comment.createdAt).toLocaleDateString()}
          </p>
          <button type="button" onClick={() => onReply(comment.id)} className="engagement-muted text-xs underline">
            Reply
          </button>
        </div>
      </div>
    </div>
  );
}

export function ContentEngagement({
  contentId,
  creatorId,
}: {
  contentId: number;
  creatorId: string;
}) {
  const { data: me } = useGetMe();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", contentId],
    queryFn: () => fetchComments(contentId),
  });

  const { data: reactions } = useQuery({
    queryKey: ["reactions", contentId],
    queryFn: () => fetchReactions(contentId),
  });

  const { data: collections } = useQuery({
    queryKey: ["collections"],
    queryFn: fetchCollections,
    enabled: !!me,
  });

  const commentMutation = useMutation({
    mutationFn: (input: { body: string; parentId?: number }) =>
      postComment(contentId, input.body, input.parentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", contentId] });
      setCommentText("");
      setReplyToId(null);
    },
  });

  const reactionMutation = useMutation({
    mutationFn: () => toggleReaction(contentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reactions", contentId] }),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const readLater = collections?.find(c => c.slug === "read-later");
      if (!readLater) throw new Error("No collection");
      return saveToCollection(readLater.id, contentId);
    },
    onSuccess: () => toast({ title: "Saved to Read Later" }),
  });

  const reportMutation = useMutation({
    mutationFn: () => reportContent(contentId, reportReason),
    onSuccess: () => {
      toast({ title: "Report submitted" });
      setShowReport(false);
      setReportReason("");
    },
  });

  const topLevel = comments.filter(c => !c.parentId);
  const repliesByParent = comments.reduce<Record<number, Comment[]>>((acc, c) => {
    if (c.parentId) {
      acc[c.parentId] = acc[c.parentId] ?? [];
      acc[c.parentId].push(c);
    }
    return acc;
  }, {});

  const replyTarget = replyToId ? comments.find(c => c.id === replyToId) : null;

  return (
    <div className="engagement-panel mt-10 pt-8 border-t" style={{ borderColor: "rgba(28,25,23,0.12)" }}>
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <button
          type="button"
          onClick={() => me ? reactionMutation.mutate() : toast({ title: "Sign in to like" })}
          className={`engagement-btn flex items-center gap-2 px-4 py-2 text-sm rounded transition-colors${reactions?.userReacted ? " engagement-btn--active" : ""}`}
        >
          ♥ {reactions?.count ?? 0} {reactions?.userReacted ? "Liked" : "Like"}
        </button>
        {me && (
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="engagement-btn px-4 py-2 text-sm rounded"
          >
            🔖 Save
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            toast({ title: "Link copied" });
          }}
          className="engagement-btn px-4 py-2 text-sm rounded"
        >
          Share
        </button>
        {me && me.clerkId !== creatorId && (
          <button
            type="button"
            onClick={() => setShowReport(v => !v)}
            className="engagement-muted px-4 py-2 text-sm rounded ml-auto"
          >
            Report
          </button>
        )}
      </div>

      {showReport && (
        <div className="mb-6 p-4 rounded engagement-btn" style={{ border: "1px solid rgba(28,25,23,0.1)" }}>
          <textarea
            value={reportReason}
            onChange={e => setReportReason(e.target.value)}
            placeholder="Why are you reporting this content?"
            rows={3}
            className="engagement-input w-full p-3 text-sm rounded mb-2"
          />
          <button
            type="button"
            onClick={() => reportMutation.mutate()}
            disabled={!reportReason.trim()}
            className="engagement-submit px-4 py-2 text-sm rounded"
          >
            Submit report
          </button>
        </div>
      )}

      <h3 className="engagement-name text-sm font-semibold mb-4" style={{ fontFamily: "sans-serif" }}>
        {comments.length} Comment{comments.length !== 1 ? "s" : ""}
      </h3>

      {me && (
        <div className="mb-6">
          {replyTarget && (
            <p className="engagement-muted text-xs mb-2">
              Replying to <CreatorName name={replyTarget.userName} verified={replyTarget.userVerified} size="sm" />
              <button type="button" className="ml-2 underline" onClick={() => setReplyToId(null)}>Cancel</button>
            </p>
          )}
          <textarea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder={replyToId ? "Write a reply…" : "Join the discussion…"}
            rows={3}
            className="engagement-input w-full p-3 text-sm rounded mb-2"
            style={{ fontFamily: "'Lora', Georgia, serif" }}
          />
          <button
            type="button"
            onClick={() => commentMutation.mutate({ body: commentText, parentId: replyToId ?? undefined })}
            disabled={!commentText.trim() || commentMutation.isPending}
            className="engagement-submit px-4 py-2 text-sm rounded"
          >
            {replyToId ? "Post reply" : "Post comment"}
          </button>
        </div>
      )}

      <div className="space-y-6">
        {topLevel.map(c => (
          <div key={c.id}>
            <CommentItem comment={c} onReply={setReplyToId} />
            {(repliesByParent[c.id] ?? []).length > 0 && (
              <div className="engagement-reply-border mt-4 ml-8 pl-4 space-y-4 border-l">
                {(repliesByParent[c.id] ?? []).map(reply => (
                  <CommentItem key={reply.id} comment={reply} onReply={setReplyToId} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
