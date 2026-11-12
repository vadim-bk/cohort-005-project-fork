# Can Cadence send web push without a mobile app?

Research for issue #4, part of map #2 (Notifications in Cadence). Researched 2026-11-12.

## Conclusion

**Yes, technically.** Browsers can deliver Web Push to a web-only app with no native app. On iPhone and iPad, though, push works only after the user adds Cadence to the Home Screen.

**Email should still be the second Channel after the Notification Feed. Web push should be third.** The map's current order stands. Here is why:

- **Reach.** Email reaches every Cadence user, because each account already has an address. Web push reaches only users who grant browser permission, one browser and device at a time. On iOS it also requires a Home Screen install, which most users never do.
- **Permission is scarce and can't be undone.** Before Firefox required a user gesture, about 99% of its prompts went unaccepted. Once a user blocks the prompt, the site cannot ask again.
- **Reliability.** Push arrives only while the browser process is running on desktop. Chrome now auto-revokes notification permission for low-engagement sites. Safari's ITP can delete the service worker registration that a classic push subscription depends on.
- **Cost.** Web push needs new client-side plumbing: a service worker, a manifest, VAPID keys, a subscribe UI, and subscription storage at the vendor. Email needs none of it, and the chosen vendor can send email itself (one-vendor goal).

Web push is a good *optional opt-in* to add later. Offer it with a double-permission prompt in settings or after a meaningful action, never on page load.

## 1. Browser support today

| Platform | Web Push | Source |
| --- | --- | --- |
| Chrome / Edge / Opera (desktop) | Yes (Chrome 50+, Edge 17+, Opera 42+) | [caniuse: Push API](https://caniuse.com/push-api) |
| Firefox (desktop) | Yes (44+) | [caniuse](https://caniuse.com/push-api) |
| Safari (macOS) | Yes since Safari 16.1 (caniuse marks 16.1–17.6 partial, 18.0+ full) | [caniuse](https://caniuse.com/push-api), [WebKit: Web Push for iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) |
| Chrome / Firefox / Samsung Internet (Android) | Yes | [caniuse](https://caniuse.com/push-api) |
| iOS / iPadOS (all browsers) | Partial: iOS/iPadOS 16.4+, **Home Screen web apps only** | [WebKit: Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/) |
| Opera Mini, IE | No | [caniuse](https://caniuse.com/push-api) |

- MDN lists the Push API as Baseline "Widely available", available across browsers since March 2023 ([MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)).
- caniuse reports 96.93% of global usage with full or partial support: 83.36% full plus 13.57% partial, the partial share being mostly iOS ([caniuse](https://caniuse.com/push-api)). The number counts browsers that *can* support push, not users who will grant permission.
- **Declarative Web Push** is Apple's addition: a standard JSON payload that the browser displays without running a service worker. It ships on iOS/iPadOS 18.4 (Home Screen web apps) and macOS Safari 18.5. Older browsers fall back to the service-worker path ([WebKit: Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/)).

## 2. The iOS/iPadOS Home Screen requirement

- "iOS and iPadOS 16.4 add support for Web Push to web apps added to the Home Screen" ([WebKit: Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)). In a normal Safari tab on iPhone, push is not available.
- The site needs a web app manifest with `display` set to `standalone` or `fullscreen`. The optional `id` member lets iOS sync Focus settings across devices ([WebKit: Web Push for iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- The permission request must come from direct user interaction, such as tapping a subscribe button, inside the installed app ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- Third-party iOS browsers can offer "Add to Home Screen" since 16.4 ([WebKit: Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)).
- Since iOS/iPadOS 26, "every website added to the Home Screen opens as a web app" by default, and users can turn it off ([WebKit: WWDC25 / Safari 26](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)). This removes one obstacle, but the user still has to perform the install.
- No Apple Developer Program membership is needed. If you filter outbound push endpoints, allow `*.push.apple.com` ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).

**Implication:** for iPhone users, web push is gated behind a manual install step that Cadence has to teach. Email has no such gate.

## 3. What a React Router 8 app needs

Web Push is built on three W3C standards: the Push API, the Notifications API, and Service Workers ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). Cadence (`react-router` 8.3.0 on Vite, SSR on, existing `public/` folder) would need these pieces:

1. **HTTPS.** Service workers, `PushManager.subscribe()` and `Notification.requestPermission()` work only in secure contexts. `localhost` counts as secure for development ([MDN: subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe), [MDN: requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static)).
2. **A service worker file served at the site root,** for example `public/sw.js`. Vite serves `public/` as-is at `/` ([Vite: the public directory](https://vite.dev/guide/assets#the-public-directory)), and a worker's default scope is the directory of its script URL ([MDN: ServiceWorkerContainer.register](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)). Register it on the client only, for example in a `useEffect` in `app/root.tsx`, never during SSR. The worker handles `push` with `registration.showNotification()`, `notificationclick` to open the right Cadence URL, and `pushsubscriptionchange` to resubscribe ([MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)).
3. **A web app manifest** (`public/manifest.webmanifest` with `display: "standalone"`), linked from `root.tsx`. It is required for iOS ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
4. **VAPID keys.** Generate an ECDSA P-256 key pair once. The client passes the public key as `applicationServerKey`. The server, or here the vendor, signs every push with the private key as a JWT ([MDN: subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe), [web.dev: Push overview](https://web.dev/articles/push-notifications-overview)). Chrome and Edge reject subscriptions without `userVisibleOnly: true`, and Chrome requires `applicationServerKey` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe), [web.dev](https://web.dev/articles/push-notifications-overview)). With a hosted vendor, the vendor normally holds the keys or accepts yours.
5. **Subscription storage.** The `PushSubscription` (endpoint plus encryption keys) must be stored long-term and kept secret: the endpoint is a capability URL ([MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [web.dev](https://web.dev/articles/push-notifications-overview)). The map makes the vendor the record of Notifications, so the subscription is posted to the vendor's channel-data API for the user and not stored in SQLite.
6. **Payload encryption and delivery.** Payloads are encrypted with the subscription keys and sent to the browser vendor's push service. That service queues messages while the device is offline, and supports TTL, urgency and topic ([web.dev](https://web.dev/articles/push-notifications-overview)). A hosted vendor handles this step.
7. **Optional: Declarative Web Push payloads,** so Safari can show the notification even if the service worker fails or was removed ([WebKit: Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/)).
8. **Test seam.** None of this runs under `npm run test`. The fake notifier from the map covers push the same way it covers email.

## 4. Permission prompt rules

- **User gesture.** Call `subscribe()` and `requestPermission()` from a user action such as a click. Firefox has enforced this since version 72 ([MDN: subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)). Without a gesture, Firefox shows only an address-bar icon ([Mozilla: Restricting notification permission prompts](https://blog.mozilla.org/futurereleases/2019/11/04/restricting-notification-permission-prompts-in-firefox/)). Safari on iOS requires direct user interaction ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- **Acceptance data.** In Mozilla's study, about 99% of notification prompts went unaccepted and 48% were actively denied. Firefox 63 telemetry showed 1.45 billion prompts and 23.66 million accepts. Prompts that followed a user interaction did better: 52% first-time allow on Nightly ([Mozilla](https://blog.mozilla.org/futurereleases/2019/11/04/restricting-notification-permission-prompts-in-firefox/)).
- **Quieter UI in Chrome.** Chrome 80 introduced a quieter notification permission UI that turns on automatically for users who usually block prompts and for sites with very low opt-in rates. Chrome 84 extended it to sites with abusive prompts or abusive content ([Chromium Blog, Jan 2020](https://blog.chromium.org/2020/01/introducing-quieter-permission-ui-for.html), [Chromium Blog, May 2020](https://blog.chromium.org/2020/05/protecting-chrome-users-from-abusive.html)). Prompting early or often lowers future opt-in.
- **Auto-revocation in Chrome (Oct 2025).** Chrome removes notification permission from sites with very low engagement that send a high volume of notifications, on Android and desktop. Installed web apps are exempt. Google says "less than 1% of all notifications receive any interaction" ([Google: Reducing notification overload](https://blog.google/chromium/automatic-notification-permission/)).
- **Blocking is close to permanent.** "If the user *blocks* the permission request, your web app can't ask for permission again." Use the double-permission pattern: an in-app explainer first, and the browser prompt only after the user says yes. Ask in context, for example after enrolling, and offer a settings toggle and a clear opt-out ([web.dev: Permission UX](https://web.dev/articles/push-notifications-permissions-ux)).

## 5. Reliability and reach compared with email

| | Web push | Email |
| --- | --- | --- |
| Who can receive it | Only users who granted permission, per browser and device. On iOS, only after a Home Screen install. | Every user (an address already exists on the account) |
| Delivery conditions | Desktop: only while the browser process runs, even with no windows open ([web.dev FAQ](https://web.dev/articles/push-notifications-faq)). Android wakes the browser. The push service queues messages until TTL expires ([web.dev](https://web.dev/articles/push-notifications-overview)). | Lands in an inbox and persists. Readable later on any device. |
| Silent loss | Chrome auto-revokes for low engagement ([Google](https://blog.google/chromium/automatic-notification-permission/)). Safari can revoke a subscription if the worker fails to show a notification in time, and ITP deletes service worker registrations for sites not visited recently, breaking classic subscriptions ([WebKit: Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/)). | Spam filtering, mitigated by authentication. Gmail requires SPF or DKIM, TLS and a spam rate under 0.3% from all senders. Bulk senders (more than 5,000 a day) also need DMARC and one-click unsubscribe ([Google: Email sender guidelines](https://support.google.com/a/answer/81126)). |
| Immediacy | High. A real-time OS notification when it works. | Lower. Fine for Cadence's Notifications (refund decisions, enrollments, questions), which are not time-critical to the second. |
| Cadence build cost | Service worker, manifest, VAPID, subscribe UI, install guide for iOS | Templates, sender domain (SPF/DKIM/DMARC), unsubscribe path, all handled mostly at the vendor |

## Open points for the map

- Choose a vendor whose free tier covers both email and web push (one signup), even though push ships later.
- Web push rollout is a separate, later slice. It needs settings-page opt-in, double-permission prompting, and an "Add to Home Screen" hint for iOS users.
