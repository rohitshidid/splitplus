import { Expense, ExpenseSplit } from "@/types";

/**
 * The shares of an expense that can actually be owed. The payer's own share is
 * never a debt - you don't owe yourself - so it is never settleable either.
 */
export const settleableShares = (e: Expense): ExpenseSplit[] =>
    (e.splits || []).filter(s => s.userId !== e.paidBy);

/**
 * What each member is up (fronted more than their share) or down.
 *
 * Walked share by share rather than "the payer gets the whole total back", because
 * a settled share has to leave both sides at once: the debtor stops owing it and
 * the payer stops being owed it. Anything else leaves the books unbalanced.
 *
 * Shared by the real group view and the landing page demo so the two can never
 * disagree about what a number means.
 */
export function computeBalances(expenses: Expense[], memberIds: string[]): Record<string, number> {
    const bal: Record<string, number> = {};
    memberIds.forEach(id => { bal[id] = 0; });

    expenses.forEach(e => {
        (e.splits || []).forEach(s => {
            if (s.settled) return;             // squared up: neither side is exposed
            if (s.userId === e.paidBy) return; // nobody owes themselves
            bal[e.paidBy] = (bal[e.paidBy] || 0) + s.amount;
            bal[s.userId] = (bal[s.userId] || 0) - s.amount;
        });
    });

    return bal;
}

/** Everything still owed across every expense. */
export const outstandingTotal = (expenses: Expense[]): number =>
    expenses.reduce(
        (sum, e) => sum + settleableShares(e).filter(s => !s.settled).reduce((n, s) => n + s.amount, 0),
        0
    );

/**
 * Splits a total evenly, distributing the leftover cents one at a time so the
 * shares always add back up to exactly the total.
 */
export function equalSplit(total: number, memberIds: string[]): ExpenseSplit[] {
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / memberIds.length);
    let remainder = cents - base * memberIds.length;

    return memberIds.map(id => {
        const extra = remainder > 0 ? 1 : 0;
        remainder -= extra;
        return { userId: id, amount: (base + extra) / 100 };
    });
}
