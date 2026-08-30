"use client";

import { useMemo, useState } from "react";
import { Expense, ExpenseSplit, SplitType } from "@/types";
import { computeBalances, equalSplit, outstandingTotal, settleableShares } from "@/lib/balances";
import BrandIcon from "@/components/BrandIcon";

/**
 * A working Splitplus group, running in the page.
 *
 * It uses the same balance reducer as the real app (`@/lib/balances`), so what a
 * visitor sees here is what the product actually does - nothing is faked or
 * pre-rendered. Nothing is saved: reloading gets you a fresh trip.
 */

const PEOPLE = [
    { id: "r", name: "Rohit", you: true },
    { id: "a", name: "Ana" },
    { id: "m", name: "Marco" },
    { id: "j", name: "Jo" }
];
const IDS = PEOPLE.map(p => p.id);
const nameOf = (id: string) => PEOPLE.find(p => p.id === id)?.name ?? "?";
const money = (n: number) => `$${Math.abs(n).toFixed(2)}`;

const exact = (pairs: Record<string, number>): ExpenseSplit[] =>
    IDS.map(id => ({ userId: id, amount: pairs[id] ?? 0 }));

const seed = (): Expense[] => [
    {
        id: "e1", groupId: "g", description: "Dinner at Ramiro", amount: 148,
        paidBy: "r", splitType: "EQUAL", createdAt: 4,
        // Jo already squared up, so the page shows both states from the start.
        splits: equalSplit(148, IDS).map(s => (s.userId === "j" ? { ...s, settled: true } : s))
    },
    {
        id: "e2", groupId: "g", description: "Apartment, 3 nights", amount: 318,
        paidBy: "a", splitType: "EXACT", createdAt: 3,
        splits: exact({ r: 106, a: 106, m: 74, j: 32 })
    },
    {
        id: "e3", groupId: "g", description: "Airport taxi", amount: 41.3,
        paidBy: "m", splitType: "EQUAL", createdAt: 2,
        splits: equalSplit(41.3, IDS)
    },
    {
        id: "e4", groupId: "g", description: "Tram passes", amount: 105.5,
        paidBy: "r", splitType: "PERCENTAGE", createdAt: 1,
        splits: exact({ r: 42.2, a: 31.65, m: 21.1, j: 10.55 })
    }
];

export default function SplitDemo() {
    const [expenses, setExpenses] = useState<Expense[]>(seed);
    const [open, setOpen] = useState<string | null>("e1");
    const [adding, setAdding] = useState(false);
    const [touched, setTouched] = useState(false);

    const [desc, setDesc] = useState("");
    const [amount, setAmount] = useState("");
    const [paidBy, setPaidBy] = useState("r");
    const [splitType, setSplitType] = useState<SplitType>("EQUAL");
    const [shares, setShares] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState("");

    const balances = useMemo(() => computeBalances(expenses, IDS), [expenses]);
    const outstanding = useMemo(() => outstandingTotal(expenses), [expenses]);
    const tracked = useMemo(() => expenses.reduce((n, e) => n + e.amount, 0), [expenses]);

    const toggleShare = (expenseId: string, userId: string) => {
        setTouched(true);
        setExpenses(prev => prev.map(e =>
            e.id !== expenseId ? e : {
                ...e,
                splits: e.splits.map(s => s.userId === userId ? { ...s, settled: !s.settled } : s)
            }
        ));
    };

    const resetForm = () => {
        setDesc(""); setAmount(""); setPaidBy("r");
        setSplitType("EQUAL"); setShares({}); setFormError(""); setAdding(false);
    };

    const addExpense = (ev: React.FormEvent) => {
        ev.preventDefault();
        setFormError("");

        const total = parseFloat(amount);
        if (!desc.trim()) return setFormError("Give it a description.");
        if (isNaN(total) || total <= 0) return setFormError("That amount doesn't look right.");

        let splits: ExpenseSplit[];
        if (splitType === "EQUAL") {
            splits = equalSplit(total, IDS);
        } else if (splitType === "EXACT") {
            let sum = 0;
            splits = IDS.map(id => {
                const v = parseFloat(shares[id] || "0");
                sum += v;
                return { userId: id, amount: v };
            });
            if (Math.abs(sum - total) > 0.01) {
                return setFormError(`Shares add up to ${money(sum)}, but the total is ${money(total)}.`);
            }
        } else {
            let sum = 0;
            splits = IDS.map(id => {
                const p = parseFloat(shares[id] || "0");
                sum += p;
                return { userId: id, amount: (p / 100) * total };
            });
            if (Math.abs(sum - 100) > 0.1) {
                return setFormError(`Percentages add up to ${sum.toFixed(1)}%, not 100%.`);
            }
        }

        const created: Expense = {
            id: `e${Date.now()}`, groupId: "g", description: desc.trim(),
            amount: total, paidBy, splits, splitType,
            createdAt: Date.now()
        };

        setTouched(true);
        setExpenses(prev => [created, ...prev]);
        setOpen(created.id);
        resetForm();
    };

    return (
        <div className="win demo">
            <div className="win-bar">
                <i /><i /><i />
                <BrandIcon size={14} style={{ marginLeft: 10, borderRadius: 4 }} />
                <span className="win-title">Splitplus — Lisbon, four of us</span>
                {touched && (
                    <button
                        type="button"
                        className="demo-reset"
                        onClick={() => { setExpenses(seed()); setOpen("e1"); setTouched(false); resetForm(); }}
                    >
                        Reset
                    </button>
                )}
            </div>

            <div className="win-body">
                <div className="g-head">
                    <div className="avatar" style={{ width: 40, height: 40, borderRadius: 12, fontSize: "1rem" }}>L</div>
                    <div className="grow">
                        <div className="g-title">Lisbon, four of us</div>
                        <div className="g-sub">
                            4 members · {expenses.length} expense{expenses.length === 1 ? "" : "s"} · {money(tracked)} tracked
                        </div>
                    </div>
                    <span className={`pill ${outstanding > 0.005 ? "pill-amber" : "pill-green"}`}>
                        {outstanding > 0.005 ? `${money(outstanding)} owed` : "All settled"}
                    </span>
                </div>

                <div className="g-main">
                    {/* Balances - recomputed from scratch on every interaction */}
                    <div className="g-col">
                        <div className="g-label">Balances</div>
                        {PEOPLE.map(p => {
                            const b = balances[p.id] || 0;
                            const up = b > 0.005;
                            const down = b < -0.005;
                            return (
                                <div className="g-bal" key={p.id}>
                                    <span className="avatar">{p.name.charAt(0)}</span>
                                    <span className="nm">
                                        {p.name}
                                        {p.you && <span className="faint" style={{ fontWeight: 400 }}> (you)</span>}
                                    </span>
                                    <span className={`amt ${up ? "up" : down ? "down" : "flat"}`}>
                                        {up ? `gets back ${money(b)}` : down ? `owes ${money(b)}` : "settled up"}
                                    </span>
                                </div>
                            );
                        })}
                        <p className="demo-hint">
                            Settle a share on the right and watch both sides of the debt move.
                        </p>
                    </div>

                    {/* Expenses - click one to open its shares */}
                    <div className="g-col">
                        <div className="g-label row-between">
                            <span>Expenses</span>
                            <button type="button" className="demo-add" onClick={() => setAdding(v => !v)}>
                                {adding ? "Cancel" : "+ Add"}
                            </button>
                        </div>

                        {adding && (
                            <form onSubmit={addExpense} className="demo-form">
                                <input
                                    className="input" placeholder="What was it?"
                                    value={desc} onChange={e => setDesc(e.target.value)}
                                />
                                <div className="row">
                                    <input
                                        className="input grow" type="number" step="0.01" placeholder="0.00"
                                        value={amount} onChange={e => setAmount(e.target.value)}
                                    />
                                    <select className="input grow" value={paidBy} onChange={e => setPaidBy(e.target.value)}>
                                        {PEOPLE.map(p => <option key={p.id} value={p.id}>{p.name} paid</option>)}
                                    </select>
                                </div>
                                <div className="row">
                                    {(["EQUAL", "EXACT", "PERCENTAGE"] as const).map(t => (
                                        <button
                                            key={t} type="button" onClick={() => setSplitType(t)}
                                            className={`btn btn-sm grow ${splitType === t ? "btn-primary" : "btn-outline"}`}
                                        >
                                            {t === "EQUAL" ? "Equally" : t === "EXACT" ? "Exact" : "Percent"}
                                        </button>
                                    ))}
                                </div>
                                {splitType !== "EQUAL" && (
                                    <div className="stack">
                                        {PEOPLE.map(p => (
                                            <div className="row" key={p.id}>
                                                <span className="grow" style={{ fontSize: ".8rem" }}>{p.name}</span>
                                                <input
                                                    className="input" type="number" step="0.01" placeholder="0"
                                                    style={{ width: 90 }}
                                                    value={shares[p.id] || ""}
                                                    onChange={e => setShares(s => ({ ...s, [p.id]: e.target.value }))}
                                                />
                                                <span className="faint" style={{ width: 12 }}>
                                                    {splitType === "PERCENTAGE" ? "%" : "$"}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {formError && <p className="notice notice-error" style={{ fontSize: ".78rem" }}>{formError}</p>}
                                <button type="submit" className="btn btn-primary btn-sm">Add expense</button>
                            </form>
                        )}

                        {expenses.map(e => {
                            const owed = settleableShares(e);
                            const done = owed.filter(s => s.settled).length;
                            const all = owed.length > 0 && done === owed.length;
                            const isOpen = open === e.id;
                            const label = e.splitType === "EQUAL" ? "split equally"
                                : e.splitType === "EXACT" ? "exact amounts" : "by percentage";

                            return (
                                <div key={e.id} className={`demo-exp ${all ? "is-settled" : ""}`}>
                                    <button type="button" className="demo-exp-row" onClick={() => setOpen(isOpen ? null : e.id)}>
                                        <span className="grow">
                                            <span className="d">{e.description}</span>
                                            <span className="m">
                                                {nameOf(e.paidBy)} paid · {label} · {done}/{owed.length} settled
                                            </span>
                                        </span>
                                        <span className="v">{money(e.amount)}</span>
                                        <span className="caret">{isOpen ? "▴" : "▾"}</span>
                                    </button>

                                    {isOpen && (
                                        <div className="demo-shares">
                                            {owed.map(s => (
                                                <div key={s.userId} className={`demo-share ${s.settled ? "is-settled" : ""}`}>
                                                    <span className="grow">{nameOf(s.userId)}</span>
                                                    <span className="amt">{money(s.amount)}</span>
                                                    <button
                                                        type="button"
                                                        className={`btn btn-sm ${s.settled ? "btn-ghost" : "btn-primary"}`}
                                                        onClick={() => toggleShare(e.id, s.userId)}
                                                    >
                                                        {s.settled ? "Undo" : "Settle"}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
