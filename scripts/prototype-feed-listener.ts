// PROTOTYPE — throwaway. Plays the receiving user's browser: signs a user
// token, opens the headless Knock feed over the socket, waits for a realtime
// Notification, then checks read/unread survives a refetch.
// Usage: tsx --env-file=.env scripts/prototype-feed-listener.ts <cadenceUserId>
// @knocklabs/client only opens its realtime socket when `window` exists
// (it is a browser SDK). Shim just enough of it for Node.
const noop = () => {};
Object.assign(globalThis, {
  window: { addEventListener: noop, removeEventListener: noop },
  document: { visibilityState: "visible", hidden: false, addEventListener: noop, removeEventListener: noop },
});
const { default: Knock } = await import("@knocklabs/client");
import { signUserToken } from "@knocklabs/node";

const userId = `cadence-user-${process.argv[2]}`;
const knock = new Knock(process.env.KNOCK_PUBLIC_API_KEY!);
knock.authenticate(userId, await signUserToken(userId));
const feed = knock.feeds.initialize(process.env.KNOCK_FEED_CHANNEL_ID!);
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

const counts = () => feed.getState().metadata;
const timeout = setTimeout(() => { log("TIMEOUT: no realtime Notification"); process.exit(1); }, 60_000);

feed.on("items.received.realtime", async ({ items }: { items: any[] }) => {
  clearTimeout(timeout);
  const item = items[0];
  log("REALTIME received", item.id, "read_at:", item.read_at);
  log("body:", item.blocks.find((b: any) => b.name === "body")?.rendered);
  log("counts after arrival", counts());

  await feed.markAsRead(item);
  await feed.fetch();
  log("after markAsRead + refetch: read_at =", feed.getState().items.find((i) => i.id === item.id)?.read_at, counts());

  await feed.markAsUnread(item);
  await feed.fetch();
  log("after markAsUnread + refetch: read_at =", feed.getState().items.find((i) => i.id === item.id)?.read_at, counts());
  process.exit(0);
});

feed.listenForUpdates();
await feed.fetch();
log("LISTENING as", userId, "initial items:", feed.getState().items.length, counts());
