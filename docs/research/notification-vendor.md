# Research: which hosted notification vendor should Cadence use?

Ticket: vadim-bk/cohort-005-project-fork#3 (parent map #2). Researched 2026-11-12 against vendor pricing pages and docs. All prices are in USD per month and were checked on that date.

## Recommendation

**Knock**, with **Resend** as its email provider.
**Runner-up: Novu Cloud.**

Knock is the best fit for the main channel, the Notification Feed. It has the most complete headless feed client (read, unread, seen, archived and realtime over a websocket), RS256 user tokens signed on the server with a Node helper, and fine-grained preferences you can read and write through the API. Its free tier has no workflow cap, unlimited environments and unlimited feed retention.

The catch applies to every vendor, not only Knock. **No orchestration vendor checked sends production email itself.** Knock, Novu, Courier, MagicBell, SuprSend and Engagespot all ship a test-only email sender and expect you to connect SendGrid, Resend, Postmark or similar. So "one vendor that also sends email" can't be had from this category. The fewest sign-ups is two: Knock plus Resend. Resend's free tier is 3,000 emails a month.

## Comparison

| | Knock | Novu Cloud | Courier | MagicBell | SuprSend | Pingram (ex-NotificationAPI) | Engagespot |
|---|---|---|---|---|---|---|---|
| Free tier | 10k messages/mo, unlimited workflows, unlimited environments, unlimited feed retention | 10k workflow runs/mo, **5 workflows**, 2 environments, 30-day inbox retention | 10k sends/mo | **1,000 deliveries/mo**, 1 project | 10k notifications/mo; preferences **not on Free** | 3,000 emails/in-app + 100 SMS | Not verifiable (site returned 404) |
| First paid tier | Starter $250 (50k, then $0.005 each) | Pro from $30 (30k+, $1.20 per 1k) | Business $0.005 per send | Startup $249 (50k) | Essentials $100 (50k) | Tier 1 $20 | Growth $250 (secondary source) |
| Headless feed + read/unread + realtime | Yes: `FeedClient` with `markAsRead`/`markAsUnread`/`markAsSeen`/`markAsArchived`, `listenForUpdates` websocket | Yes: `@novu/react` hooks `useNotifications`, `useCounts`, `novu.on(...)` realtime events | Yes, Inbox with read, archive and realtime sync; headless hooks not clearly documented | Current React package is prebuilt components; no documented hooks | Yes (`@suprsend/react-core`, headless) | Feed component claimed; in-app docs return 404 | In-app is the default channel |
| Built-in production email | No (test channel: 100/mo, account members only) | No (demo: 300/mo, your own address only) | No (Test Email Provider only) | No (default provider: workspace members only) | No (bring your own) | **Yes** (managed SMTP, verified domain) | No (default providers are test-only) |
| Web push | Via FCM only; no native channel | Via FCM, OneSignal, Pushpad or Pusher Beams | Via OneSignal, MagicBell and others | **Native VAPID** | Native ("direct integration") | Not confirmed in current docs | Default web push provider (test-only) |
| Server-signed user token | RS256 JWT, `signUserToken` in `@knocklabs/node` | HMAC-SHA256 `subscriberHash` | JWT made by your backend | HS256 user JWT | Yes (not examined in depth) | HMAC `hashedUserId` ("secure mode") | Not examined |
| Per-user preferences | Workflow, category, channel type and channel, through the API | Yes (no headless preferences hook documented) | Yes, by subscription topic | Yes (component) | **Business plan only ($250)** | Yes (channel × type matrix, per secondary sources) | Not examined |

## Findings by vendor

### Knock (recommended)

- **Pricing.** Free: up to 10,000 messages a month, on any channel. Starter: $250 a month for 50,000, then $0.005 each. Then Enterprise. Free includes unlimited workflows, unlimited isolated environments, unlimited team members and feed retention of "No limit, but can be configured", with 30-day logs and Knock branding. There is no tier between Free and $250. — https://knock.app/pricing
- **Feed, headless.** `KnockProvider`, `useKnockClient`, `useNotifications(knockClient, channelId)` and `useNotificationStore(feedClient)` give you a fully custom UI. You must mark items seen yourself. — https://docs.knock.app/in-app-ui/react/headless/feed
- **Read state and realtime.** `FeedClient` has `markAsRead`, `markAsUnread`, `markAllAsRead`, `markAsSeen`, `markAsUnseen`, `markAsArchived` and `markAsUnarchived`. `listenForUpdates` connects to the realtime socket and emits `items.received.realtime`. — https://docs.knock.app/in-app-ui/javascript/sdk/feed-client
- **User tokens.** In enhanced security mode, Knock rejects requests made with the public key unless they carry a signed user token. The token is an RS256 JWT with a `sub` claim, signed with `KNOCK_SIGNING_KEY`. Node has a `signUserToken` helper (`@knocklabs/node/lib/tokenSigner`) that defaults to a 1-hour expiry. The client has an `onUserTokenExpiring` callback for refreshing it. This fits `getCurrentUserId` and signing on the server. — https://docs.knock.app/in-app-ui/security-and-authentication
- **Preferences.** You can set them by category, channel type (email or push), specific channel, or workflow, and combine those levels. They are read and written through the API (`users.setPreferences`), so a custom `settings.tsx` page is straightforward. — https://docs.knock.app/preferences/overview
- **Email.** The built-in "Knock test" channel is for testing only. It sends 100 a month, only to members of your Knock account. For production you configure a provider: Resend, Postmark, SendGrid, SES, Mailgun, SMTP and others. — https://docs.knock.app/integrations/email/knock-test
- **Resend setup.** Each environment gets its own settings (API key, sandbox mode, tracking). The From domain must be verified in Resend. A delivery-status webhook is optional. — https://docs.knock.app/integrations/email/resend
- **Web push.** There is no first-party web push channel. Knock sends browser push through FCM, and you manage device tokens. — https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm, https://docs.knock.app/integrations/push/overview
  - Shipping web push would add Firebase as a third service, which is free.

### Novu Cloud (runner-up)

- **Pricing.**

  | Plan | Price | Included runs | Workflows | Environments | Activity feed |
  |---|---|---|---|---|---|
  | Free | $0 | 10,000 a month | 5 | 2 (Dev and Prod) | 24 hours |
  | Pro | from $30 | 30,000+, then $1.20 per 1k | 20 | 2 | 7 days |
  | Team | from $250 | 250,000+ | 100 | up to 10 | 90 days |

  All channels are included on Free. — https://novu.co/pricing
- **Free-tier retention.** The docs limits page agrees on 5 workflows on Free and gives inbox feed retention of 30 days. — https://docs.novu.co/platform/developer/limits
- **Headless.** `@novu/react` provides `NovuProvider`, `useNotifications` (pagination and realtime), `useCounts` (unread and unseen, realtime) and `useNovu`. Actions include `novu.notifications.read(...)` and `archive(...)`. Realtime events include `notifications.notification_received` and `notifications.unread_count_changed`. — https://docs.novu.co/platform/inbox/headless-mode
- **User tokens.** `subscriberHash = HMAC-SHA256(secretKey, subscriberId)`, computed on the server. Once HMAC is on, the Inbox won't load without it. — https://docs.novu.co/platform/inbox/prepare-for-production
- **Email.** The demo email integration sends 300 a month, only to your own Novu login address, and is "strictly for testing". A real provider is needed for production. — https://docs.novu.co/platform/integrations/demo-providers
- **Web push.** Through FCM, OneSignal, Pushpad or Pusher Beams. — https://docs.novu.co/platform/integrations/push
- **Why it is second.** The 5-workflow cap on Free is too small for a catalogue that covers four roles, because each Notification type is normally its own workflow. Retention on Free is 30 days, against unlimited on Knock. The cheap $30 Pro tier is Novu's real advantage over Knock's $250 jump.

### Courier

- **Pricing.** Free Developer plan: 10,000 sends a month. Business: $0.005 per send, pay as you go. — https://www.courier.com/pricing
- **Inbox.** Hosted, with read and archive, realtime sync, and JWT auth: the backend makes a JWT and the client calls `signIn({ userId, jwt })`. — https://www.courier.com/docs/in-app/overview.md
- **Email.** Only the "Courier Test Email Provider", for test mode. Production needs your own provider. — https://www.courier.com/docs/guides/send-your-first-email
- **Web push.** Only through third parties (OneSignal, MagicBell and others). — https://www.courier.com/docs/integrations/push/overview.md
- **Preferences.** Subscription-topic preferences API. — https://www.courier.com/docs/platform/preferences/preferences-overview.md
- **Verdict.** Viable, but its headless React story is less clearly documented than Knock's or Novu's.

### MagicBell

- **Pricing.** Free: 1,000 deliveries a month, 1 project. Startup: $249 for 50k. — https://www.magicbell.com/pricing
- **Web push.** Native VAPID web push, the strongest of any vendor here. — https://www.magicbell.com/docs/channels/web_push
- **User tokens.** HS256 user JWTs signed with the project secret. — https://www.magicbell.com/docs/api/authentication/user
- **Email.** The default email provider can only send to workspace members. — https://magicbell.com/docs/email
- **React package.** The current `@magicbell/react` is prebuilt components, with no documented hooks. — https://magicbell.com/docs/libraries/react-headless
- **Verdict.** The free tier is too small, and the headless feed is weak.

### SuprSend

- **Pricing.**

  | Plan | Price | Included | Overage |
  |---|---|---|---|
  | Free | $0 | 10k a month, in-app feed with branding | — |
  | Essentials | $100 | 50k | $2 per 1k |
  | Business | $250 | 50k | $5 per 1k |

  **User Preferences are a Business-plan feature.** Email needs a downstream provider. Web push is a direct integration. — https://www.suprsend.com/pricing
- **Verdict.** The preferences paywall rules it out.

### Pingram (formerly NotificationAPI): extra candidate

- **What it is.** It is the only vendor found that sends production email itself. Its email docs say "You DON'T need another 3rd-party email service", there are no bring-your-own SMTP providers yet, and you send from your domain once it is verified. — https://www.pingram.io/docs/email/overview
- **Pricing.** Free: 3,000 emails or in-app messages plus 100 SMS. Tier 1: $20. — https://www.pingram.io/pricing
- **User tokens.** It has an HMAC "secure mode" (`hashedUserId`). — https://docs.notificationapi.com/guides/secure-mode
- **Why not.** The product has repositioned around email, SMS and voice:
  - The docs index has no in-app, web push or preferences pages. — https://www.pingram.io/docs
  - The in-app docs and channel pages that `llms-full.txt` links to return 404. — https://www.pingram.io/docs/channels/in-app
  - The `@pingram/react` package that `llms-full.txt` names does not exist on npm. The older `@notificationapi/react`, v2.0.1, still exists.

  The Notification Feed is Cadence's main channel and is meant to be the record of Notifications, so this is too risky. Revisit it only if one-vendor email becomes a hard requirement.

### Engagespot

- **Status.** `engagespot.co` and `engagespot.co/pricing` returned HTTP 404 on 2026-11-12, so I couldn't verify pricing from a primary source. A secondary source (June 2026) lists Launch: free, 10k triggers; Growth: $250.
- **Docs.** They say the default providers, including web push, are for testing only. The email providers are SendGrid, Mailgun, SES, Postmark and Mailersend. — https://es-docs-prod.netlify.app/docs/1.0.0/channels/what-are-providers
- **Verdict.** Excluded, because the site being down is a red flag for a production dependency.

## Email provider to pair with Knock

**Resend.**

- **Free.** 3,000 emails a month, 100 a day, 3 domains, 30-day retention.
- **Pro.** $20 a month for 50,000 emails, then $0.90 per 1,000, with no daily cap.

— https://resend.com/pricing

Knock has a first-party Resend channel that you configure per environment. — https://docs.knock.app/integrations/email/resend

## Notes for the spec

- **Tests.** Every vendor's Node SDK is a plain HTTP client, so the seam belongs in Cadence. A `Notifier` interface with a Knock implementation and an in-memory fake keeps `npm run test` off the network. Knock's per-environment channel config, including Resend sandbox mode, covers manual development use.
- **Web push.** Every option except MagicBell and SuprSend needs FCM (or OneSignal) for browser push. With Knock that is a free Firebase project and a service worker. That cost supports keeping email ahead of web push in the Channel ranking.
- **Cost cliff.** Knock jumps from free (10k messages) straight to $250 a month. Every Notification sent to the feed, by email or by push counts as a message. If staying cheap after the free tier matters more than feed quality and the uncapped workflows, Novu Pro at $30 is the fallback.
