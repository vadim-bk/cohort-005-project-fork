// PROTOTYPE — throwaway rough Notification Feed. Not the real look (that's
// the "What does the Notification Feed look like?" ticket). It only proves:
// signed token → headless feed → read/unread → live update over the socket.

import { useEffect, useRef, useState } from "react";
import Knock, { type Feed, type FeedStoreState } from "@knocklabs/client";
import { data } from "react-router";
import type { Route } from "./+types/prototype.notifications";
import { getCurrentUserId } from "~/lib/session";
import { feedCredentials } from "~/lib/prototype-notifier.server";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) throw data("Select a user from the DevUI panel.", { status: 401 });
  return feedCredentials(userId);
}

type View = Pick<FeedStoreState, "items" | "metadata" | "networkStatus">;

export default function PrototypeNotifications({ loaderData }: Route.ComponentProps) {
  const { userId, userToken, publicApiKey, feedChannelId } = loaderData;
  const feedRef = useRef<Feed | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const knock = new Knock(publicApiKey);
    knock.authenticate(userId, userToken);
    const feed = knock.feeds.initialize(feedChannelId, { archived: "exclude" });
    feedRef.current = feed;

    const push = (s: FeedStoreState) =>
      setView({ items: s.items, metadata: s.metadata, networkStatus: s.networkStatus });
    const unsubscribe = feed.store.subscribe(push);
    feed.on("items.received.realtime", ({ items }: { items: unknown[] }) =>
      setLog((l) => [`${new Date().toLocaleTimeString()} realtime: ${items.length} new`, ...l])
    );
    feed.listenForUpdates();
    feed.fetch();

    return () => {
      unsubscribe();
      feed.dispose();
      knock.teardown();
    };
  }, [userId, userToken, publicApiKey, feedChannelId]);

  const feed = feedRef.current;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="rounded border-2 border-dashed border-amber-500 p-3 text-sm">
        PROTOTYPE · Knock user <code>{userId}</code> · unread{" "}
        <b>{view?.metadata.unread_count ?? "…"}</b> · unseen{" "}
        <b>{view?.metadata.unseen_count ?? "…"}</b> · {view?.networkStatus}
        <button className="ml-4 underline" onClick={() => feed?.markAllAsRead()}>
          mark all read
        </button>
      </div>

      <ul className="space-y-2">
        {view?.items.length === 0 && <li className="text-muted-foreground">No Notifications.</li>}
        {view?.items.map((item) => {
          const body = item.blocks.find((b) => b.name === "body");
          const unread = !item.read_at;
          return (
            <li
              key={item.id}
              className={`rounded border p-3 ${unread ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "opacity-70"}`}
            >
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{new Date(item.inserted_at).toLocaleString()}</span>
                <button
                  className="underline"
                  onClick={() => (unread ? feed?.markAsRead(item) : feed?.markAsUnread(item))}
                >
                  mark {unread ? "read" : "unread"}
                </button>
              </div>
              <div
                className="prose prose-sm dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: body && "rendered" in body ? body.rendered : "" }}
              />
            </li>
          );
        })}
      </ul>

      <details open>
        <summary className="cursor-pointer text-sm">State</summary>
        <pre className="max-h-96 overflow-auto rounded bg-muted p-2 text-xs">
          {JSON.stringify({ log, metadata: view?.metadata, items: view?.items }, null, 2)}
        </pre>
      </details>
    </div>
  );
}
