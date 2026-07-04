"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

interface ChannelSummary {
  id: string;
  booking_id: string | null;
  lastMessage?: string;
}

interface MessageRow {
  id: number;
  channel_id: string;
  sender_id: string | null;
  content: string;
  created_at: string;
}

/** Real channels/messages backed thread view, shared by every surface
 * (a customer/contractor channel is created per booking; org channels use
 * org_id instead). Replaces the legacy localStorage-only chat mockup. */
export function MessagesView() {
  const [channels, setChannels] = useState<ChannelSummary[] | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: memberships } = await supabase.from("channel_members").select("channel_id").eq("user_id", user.id);
      const channelIds = (memberships || []).map((m) => m.channel_id);
      if (channelIds.length === 0) {
        setChannels([]);
        return;
      }
      const { data: channelRows } = await supabase.from("channels").select("id, booking_id").in("id", channelIds);
      setChannels(channelRows || []);
      if (channelRows?.[0]) setActiveChannelId(channelRows[0].id);
    })();
  }, []);

  const loadMessages = useCallback(async (channelId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("messages")
      .select("id, channel_id, sender_id, content, created_at")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  }, []);

  useEffect(() => {
    if (!activeChannelId) return;
    loadMessages(activeChannelId);

    const supabase = createClient();
    const channel = supabase
      .channel(`messages-${activeChannelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${activeChannelId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as MessageRow]),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannelId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !activeChannelId || !userId) return;
    const supabase = createClient();
    await supabase.from("messages").insert({ channel_id: activeChannelId, sender_id: userId, content: draft.trim() });
    setDraft("");
  }

  if (channels === null) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6">
        <EmptyState icon="💬" title="No conversations yet" description="Messages with your contractor appear here once you have an active booking." />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-xl flex-col px-4 py-4">
      {channels.length > 1 && (
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChannelId(ch.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                activeChannelId === ch.id ? "bg-crew-green text-white" : "bg-neutral-100 text-neutral-600"
              }`}
            >
              Booking {ch.booking_id?.slice(0, 8) || ch.id.slice(0, 8)}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto rounded-xl2 border border-neutral-200 bg-white p-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
              m.sender_id === userId ? "ml-auto bg-crew-green text-white" : "bg-neutral-100 text-crew-ink"
            }`}
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="mt-2 flex gap-2">
        <label htmlFor="message-draft" className="sr-only">
          Message
        </label>
        <input
          id="message-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message"
          className="flex-1 rounded-full border border-neutral-300 px-4 py-2 text-sm"
        />
        <button type="submit" className="rounded-full bg-crew-green px-4 py-2 text-sm font-semibold text-white">
          Send
        </button>
      </form>
    </div>
  );
}
