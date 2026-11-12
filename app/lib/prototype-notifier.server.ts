// PROTOTYPE — throwaway. Answers: "Does one real Notification flow
// end-to-end through Knock?" Lives on the prototype/knock-notification-e2e
// branch only. Not production code: no retries, no error handling.

import { Knock, signUserToken } from "@knocklabs/node";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { courses, purchases, refunds, RefundStatus, users } from "~/db/schema";

/** Knock workflow key. Create it in the Knock dashboard (Development). */
export const REFUND_DECIDED_WORKFLOW = "refund-request-decided";

export type RefundDecidedNotification = {
  recipient: { id: number; name: string; email: string };
  actor: { id: number; name: string };
  decision: "approved" | "declined";
  courseTitle: string;
  amount: string;
  note: string | null;
  refundRequestId: number;
  decidedAt: string;
};

/**
 * THE SEAM. Server actions depend on this, never on Knock directly, so
 * `npm run test` can pass `fakeNotifier()` and never touch the network.
 */
export interface Notifier {
  refundDecided(notification: RefundDecidedNotification): Promise<void>;
}

/** Knock user ids are strings. Cadence user ids are numbers. */
const knockUserId = (id: number) => `cadence-user-${id}`;

export function knockNotifier(apiKey = process.env.KNOCK_API_KEY): Notifier {
  const knock = new Knock({ apiKey });
  return {
    async refundDecided(n) {
      await knock.workflows.trigger(REFUND_DECIDED_WORKFLOW, {
        // Inline identify: Knock upserts the user on trigger, so Cadence
        // never has to sync users ahead of time.
        recipients: [
          { id: knockUserId(n.recipient.id), name: n.recipient.name, email: n.recipient.email },
        ],
        // Inline-identify the actor too: Knock rejects an unknown actor id
        // with `actor_missing`.
        actor: { id: knockUserId(n.actor.id), name: n.actor.name },
        data: {
          decision: n.decision,
          course_title: n.courseTitle,
          amount: n.amount,
          note: n.note,
        },
      },
      // One decision, one Notification, even if the action reruns.
      { idempotencyKey: `refund-decided-${n.refundRequestId}-${n.decidedAt}` });
    },
  };
}

/** What tests would use. Records instead of sending. */
export function fakeNotifier(): Notifier & { sent: RefundDecidedNotification[] } {
  const sent: RefundDecidedNotification[] = [];
  return {
    sent,
    async refundDecided(n) {
      sent.push(n);
    },
  };
}

/** Prototype glue: rebuild the Notification from the decided Refund Request. */
export function buildRefundDecided(
  refundRequestId: number,
  actor: { id: number; name: string }
): RefundDecidedNotification | null {
  const row = db
    .select({ refund: refunds, purchase: purchases, buyer: users, course: courses })
    .from(refunds)
    .innerJoin(purchases, eq(purchases.id, refunds.purchaseId))
    .innerJoin(users, eq(users.id, purchases.userId))
    .innerJoin(courses, eq(courses.id, purchases.courseId))
    .where(eq(refunds.id, refundRequestId))
    .get();
  if (!row) return null;
  return {
    recipient: { id: row.buyer.id, name: row.buyer.name, email: row.buyer.email },
    actor,
    decision: row.refund.status === RefundStatus.Approved ? "approved" : "declined",
    courseTitle: row.course.title,
    amount: `$${(row.purchase.amountPaid / 100).toFixed(2)}`,
    note: row.refund.decisionNote,
    refundRequestId,
    decidedAt: row.refund.resolvedAt ?? "",
  };
}

/** Signed server-side from the existing session identity. */
export async function feedCredentials(cadenceUserId: number) {
  const userId = knockUserId(cadenceUserId);
  return {
    userId,
    userToken: await signUserToken(userId, { expiresInSeconds: 60 * 60 }),
    publicApiKey: process.env.KNOCK_PUBLIC_API_KEY!,
    feedChannelId: process.env.KNOCK_FEED_CHANNEL_ID!,
  };
}
