"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { StorageService } from "@/services/StorageService";
import { Group, Expense, User, SplitType } from "@/types";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AppBar from "@/components/AppBar";

const POLL_MS = 20_000;
const money = (n: number) => `$${Math.abs(n).toFixed(2)}`;

function GroupView() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const groupId = useSearchParams().get("id");

    const [group, setGroup] = useState<Group | null>(null);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [members, setMembers] = useState<User[]>([]);
    const [requests, setRequests] = useState<User[]>([]);
    const [pending, setPending] = useState<User[]>([]);
    const [notFound, setNotFound] = useState(false);

    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [desc, setDesc] = useState("");
    const [amount, setAmount] = useState("");
    const [paidBy, setPaidBy] = useState("");
    const [splitType, setSplitType] = useState<SplitType>("EQUAL");
    const [splitInputs, setSplitInputs] = useState<Record<string, string>>({});
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const [inviteName, setInviteName] = useState("");
    const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [inviting, setInviting] = useState(false);
    const [copied, setCopied] = useState(false);

    const userId = user?.id;

    const refreshData = useCallback(() => {
        if (!groupId) return;
        const g = StorageService.getGroup(groupId);
        if (!g) {
            setNotFound(true);
            return;
        }
        setNotFound(false);
        setGroup(g);
        setExpenses(StorageService.getGroupExpenses(groupId));

        const allUsers = StorageService.getUsers();
        setMembers(allUsers.filter(u => g.members.includes(u.id)));
        setRequests(allUsers.filter(u => g.joinRequests?.includes(u.id)));
        setPending(allUsers.filter(u => g.pendingMembers?.includes(u.id)));
    }, [groupId]);

    const syncRef = useRef<() => Promise<void>>(async () => {});
    useEffect(() => {
        syncRef.current = async () => {
            if (!userId) return;
            await StorageService.syncAll(userId);
            refreshData();
        };
    });

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
            return;
        }
        if (!userId) return;

        refreshData();
        syncRef.current();

        // Expenses and approvals land from other people's devices; keep asking.
        const id = setInterval(() => {
            if (document.visibilityState === "visible") syncRef.current();
        }, POLL_MS);
        return () => clearInterval(id);
    }, [userId, user, loading, router, refreshData]);

    // Compute balances: what each member is up (paid more than their share) or down.
    const balances = useMemo(() => {
        const bal: Record<string, number> = {};
        members.forEach(m => { bal[m.id] = 0; });

        expenses.forEach(e => {
            bal[e.paidBy] = (bal[e.paidBy] || 0) + e.amount;
            (e.splits || []).forEach(s => {
                bal[s.userId] = (bal[s.userId] || 0) - s.amount;
            });
        });

        return bal;
    }, [expenses, members]);

    const totalTracked = useMemo(
        () => expenses.reduce((sum, e) => sum + e.amount, 0),
        [expenses]
    );

    const handleInvite = async () => {
        const wanted = inviteName.trim();
        if (!wanted || !groupId || !group) return;

        setInviting(true);
        setInviteMsg(null);
        try {
            // Remote lookup: the invitee almost always signed up on their own device.
            const target = await StorageService.findUserByUsernameRemote(wanted);
            if (!target) {
                setInviteMsg({ ok: false, text: `No account called "${wanted}".` });
                return;
            }
            if (group.members.includes(target.id)) {
                setInviteMsg({ ok: false, text: "They're already a member." });
                return;
            }
            if (group.pendingMembers?.includes(target.id)) {
                setInviteMsg({ ok: false, text: "They already have an invite waiting." });
                return;
            }

            const ok = await StorageService.inviteMember(groupId, target.id);
            if (!ok) {
                setInviteMsg({ ok: false, text: "Couldn't send the invite. Check your connection." });
                return;
            }

            setInviteMsg({ ok: true, text: `Invite sent to ${target.username}.` });
            setInviteName("");
            refreshData();
        } finally {
            setInviting(false);
        }
    };

    const handleApprove = async (id: string) => {
        if (!groupId) return;
        await StorageService.approveJoinRequest(groupId, id);
        refreshData();
    };

    const handleReject = async (id: string) => {
        if (!groupId) return;
        await StorageService.rejectJoinRequest(groupId, id);
        refreshData();
    };

    const resetForm = () => {
        setDesc("");
        setAmount("");
        setPaidBy("");
        setIsAdding(false);
        setEditingId(null);
        setSplitInputs({});
        setSplitType("EQUAL");
        setError("");
    };

    const populateForm = (e: Expense) => {
        setDesc(e.description);
        setAmount(e.amount.toString());
        setPaidBy(e.paidBy);
        setSplitType(e.splitType || "EQUAL");
        setEditingId(e.id);
        setIsAdding(true);
        setError("");

        const inputs: Record<string, string> = {};
        if (e.splitType === "EXACT") {
            e.splits.forEach(s => { inputs[s.userId] = s.amount.toFixed(2); });
        } else if (e.splitType === "PERCENTAGE") {
            e.splits.forEach(s => { inputs[s.userId] = ((s.amount / e.amount) * 100).toFixed(2); });
        }
        setSplitInputs(inputs);
    };

    const handleSaveExpense = async (ev: React.FormEvent) => {
        ev.preventDefault();
        setError("");

        if (!desc.trim() || !amount || !paidBy) {
            setError("Description, amount and who paid are all needed.");
            return;
        }
        if (!groupId) return;

        const total = parseFloat(amount);
        if (isNaN(total) || total <= 0) {
            setError("That amount doesn't look right.");
            return;
        }

        let splits: { userId: string; amount: number }[] = [];

        if (splitType === "EQUAL") {
            // Distribute cents so the shares always add back up to the total exactly.
            const cents = Math.round(total * 100);
            const base = Math.floor(cents / members.length);
            let remainder = cents - base * members.length;
            splits = members.map(m => {
                const extra = remainder > 0 ? 1 : 0;
                remainder -= extra;
                return { userId: m.id, amount: (base + extra) / 100 };
            });
        } else if (splitType === "EXACT") {
            let sum = 0;
            splits = members.map(m => {
                const val = parseFloat(splitInputs[m.id] || "0");
                sum += val;
                return { userId: m.id, amount: val };
            });
            if (Math.abs(sum - total) > 0.01) {
                setError(`Shares add up to ${money(sum)}, but the total is ${money(total)}.`);
                return;
            }
        } else {
            let sum = 0;
            splits = members.map(m => {
                const pct = parseFloat(splitInputs[m.id] || "0");
                sum += pct;
                return { userId: m.id, amount: (pct / 100) * total };
            });
            if (Math.abs(sum - 100) > 0.1) {
                setError(`Percentages add up to ${sum.toFixed(1)}%, not 100%.`);
                return;
            }
        }

        setSaving(true);
        if (editingId) {
            const existing = expenses.find(e => e.id === editingId);
            if (existing) {
                await StorageService.updateExpense({
                    ...existing,
                    description: desc.trim(),
                    amount: total,
                    paidBy,
                    splits,
                    splitType
                });
            }
        } else {
            await StorageService.addExpense(groupId, desc.trim(), total, paidBy, splits, splitType);
        }
        setSaving(false);

        resetForm();
        refreshData();
    };

    const handleDeleteExpense = async (id: string) => {
        if (!confirm("Delete this expense? Everyone's balance will change.")) return;
        await StorageService.deleteExpense(id);
        refreshData();
    };

    const handleDeleteGroup = async () => {
        if (!group) return;
        if (!confirm(`Delete "${group.name}" for everyone, including its expenses? This can't be undone.`)) return;
        await StorageService.deleteGroup(group.id);
        router.push("/dashboard");
    };

    const handleLeaveGroup = async () => {
        if (!group || !userId) return;
        if (!confirm(`Leave "${group.name}"? The expenses stay, so nobody else's balance changes.`)) return;
        await StorageService.leaveGroup(group.id, userId);
        router.push("/dashboard");
    };

    if (loading || !user) return null;

    if (notFound) {
        return (
            <>
                <AppBar />
                <main className="container page">
                    <div className="empty">
                        <p>That group isn&apos;t here.</p>
                        <p style={{ marginTop: 8 }}>
                            It may have been deleted, or you may have left it. <Link href="/dashboard">Back to dashboard</Link>
                        </p>
                    </div>
                </main>
            </>
        );
    }

    if (!group) {
        return (
            <>
                <AppBar />
                <main className="container page">
                    <div className="empty"><span className="spin" style={{ verticalAlign: "-2px", marginRight: 8 }} /> Loading…</div>
                </main>
            </>
        );
    }

    const isAdmin = group.createdBy === user.id;

    return (
        <>
            <AppBar right={<Link href="/profile" className="btn btn-outline btn-sm">Profile</Link>} />

            <main className="container page">
                <Link href="/dashboard" className="back">← Back to dashboard</Link>

                <header className="page-head">
                    <div className="row-between wrap" style={{ alignItems: "flex-start" }}>
                        <div className="row" style={{ alignItems: "flex-start" }}>
                            <span className="avatar" style={{ width: 44, height: 44, borderRadius: 14, fontSize: "1.1rem" }}>
                                {group.name.charAt(0).toUpperCase()}
                            </span>
                            <div>
                                <h1 style={{ fontSize: "1.8rem" }}>{group.name}</h1>
                                <p className="faint" style={{ fontSize: ".84rem", marginTop: 4 }}>
                                    {members.length} member{members.length === 1 ? "" : "s"} · {expenses.length} expense{expenses.length === 1 ? "" : "s"} · {money(totalTracked)} tracked
                                </p>
                            </div>
                        </div>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                                navigator.clipboard.writeText(group.id);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                            }}
                            title="Copy the full group ID"
                        >
                            {copied ? "Copied ✓" : "Copy group ID"}
                        </button>
                    </div>
                </header>

                {/* Admin: join requests */}
                {isAdmin && requests.length > 0 && (
                    <section className="card card-accent" style={{ marginBottom: 22 }}>
                        <span className="eyebrow">Join requests</span>
                        <div className="stack" style={{ marginTop: 14 }}>
                            {requests.map(u => (
                                <div key={u.id} className="row-between wrap">
                                    <span className="row">
                                        <span className="avatar" style={{ width: 26, height: 26, fontSize: ".75rem" }}>
                                            {u.username.charAt(0).toUpperCase()}
                                        </span>
                                        <span><strong>{u.username}</strong> wants to join</span>
                                    </span>
                                    <span className="row">
                                        <button onClick={() => handleApprove(u.id)} className="btn btn-primary btn-sm">Approve</button>
                                        <button onClick={() => handleReject(u.id)} className="btn btn-ghost btn-sm">Reject</button>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Balances */}
                <section style={{ marginBottom: 30 }}>
                    <h2 style={{ fontSize: "1.2rem", marginBottom: 12 }}>Balances</h2>
                    <div className="stack">
                        {members.map(m => {
                            const b = balances[m.id] || 0;
                            const up = b > 0.005;
                            const down = b < -0.005;
                            return (
                                <div key={m.id} className="card card-tight row">
                                    <span className="avatar" style={{ width: 28, height: 28, fontSize: ".8rem" }}>
                                        {m.username.charAt(0).toUpperCase()}
                                    </span>
                                    <span className="grow" style={{ fontWeight: 550 }}>
                                        {m.username}{m.id === user.id && <span className="faint" style={{ fontWeight: 400 }}> (you)</span>}
                                    </span>
                                    <span
                                        className="tnum"
                                        style={{ fontWeight: 600, color: up ? "var(--green)" : down ? "var(--red)" : "var(--ink-faint)" }}
                                    >
                                        {up ? `gets back ${money(b)}` : down ? `owes ${money(b)}` : "settled up"}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Expenses */}
                <section style={{ marginBottom: 30 }}>
                    <div className="row-between" style={{ marginBottom: 12 }}>
                        <h2 style={{ fontSize: "1.2rem" }}>Expenses</h2>
                        <button
                            onClick={() => { if (isAdding) resetForm(); else { resetForm(); setIsAdding(true); } }}
                            className="btn btn-primary btn-sm"
                        >
                            {isAdding ? "Cancel" : "+ Add expense"}
                        </button>
                    </div>

                    {isAdding && (
                        <form onSubmit={handleSaveExpense} className="card stack-lg" style={{ marginBottom: 16 }}>
                            <h3 style={{ fontSize: "1rem" }}>{editingId ? "Edit expense" : "New expense"}</h3>

                            <input
                                className="input"
                                placeholder="What was it? e.g. Dinner at Ramiro"
                                value={desc}
                                onChange={e => setDesc(e.target.value)}
                            />

                            <div className="row wrap">
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input grow"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                />
                                <select className="input grow" value={paidBy} onChange={e => setPaidBy(e.target.value)}>
                                    <option value="">Who paid?</option>
                                    {members.map(m => (
                                        <option key={m.id} value={m.id}>{m.username}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="row">
                                {(["EQUAL", "EXACT", "PERCENTAGE"] as const).map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setSplitType(type)}
                                        className={`btn btn-sm grow ${splitType === type ? "btn-primary" : "btn-outline"}`}
                                    >
                                        {type === "EQUAL" ? "Equally" : type === "EXACT" ? "Exact" : "Percent"}
                                    </button>
                                ))}
                            </div>

                            {splitType !== "EQUAL" && (
                                <div className="stack">
                                    {members.map(m => (
                                        <div key={m.id} className="row">
                                            <span className="grow" style={{ fontSize: ".9rem" }}>{m.username}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="input"
                                                style={{ width: 110 }}
                                                value={splitInputs[m.id] || ""}
                                                onChange={e => setSplitInputs(prev => ({ ...prev, [m.id]: e.target.value }))}
                                                placeholder="0"
                                            />
                                            <span className="faint" style={{ width: 14 }}>{splitType === "PERCENTAGE" ? "%" : "$"}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {error && <p className="notice notice-error">{error}</p>}

                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? <><span className="spin" /> Saving…</> : editingId ? "Update expense" : "Save expense"}
                            </button>
                        </form>
                    )}

                    <div className="stack">
                        {expenses.length === 0 ? (
                            <div className="empty"><p>Nothing spent yet.</p></div>
                        ) : (
                            expenses.map(e => {
                                const payer = members.find(m => m.id === e.paidBy)?.username || "Someone";
                                const label = e.splitType === "EQUAL" ? "split equally"
                                    : e.splitType === "EXACT" ? "exact amounts" : "by percentage";
                                return (
                                    <div key={e.id} className="card card-tight row">
                                        <span className="grow">
                                            <span style={{ fontWeight: 550, display: "block" }}>{e.description}</span>
                                            <span className="faint" style={{ fontSize: ".78rem" }}>{payer} paid · {label}</span>
                                        </span>
                                        <span className="tnum" style={{ fontWeight: 600 }}>{money(e.amount)}</span>
                                        <button onClick={() => populateForm(e)} className="link-btn" title="Edit" style={{ textDecoration: "none", fontSize: "1.05rem" }}>✎</button>
                                        <button onClick={() => handleDeleteExpense(e.id)} className="link-btn" title="Delete" style={{ textDecoration: "none", fontSize: "1.05rem", color: "var(--red)" }}>🗑</button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>

                {/* Members & invites */}
                <section className="card" style={{ marginBottom: 22 }}>
                    <h3 style={{ fontSize: "1rem", marginBottom: 12 }}>Invite someone</h3>
                    <div className="row">
                        <input
                            className="input grow"
                            placeholder="Their username"
                            value={inviteName}
                            onChange={e => setInviteName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleInvite(); }}
                        />
                        <button onClick={handleInvite} className="btn btn-outline" disabled={inviting}>
                            {inviting ? <span className="spin" /> : "Invite"}
                        </button>
                    </div>
                    {inviteMsg && (
                        <p className={`notice ${inviteMsg.ok ? "notice-ok" : "notice-error"}`} style={{ marginTop: 10 }}>
                            {inviteMsg.text}
                        </p>
                    )}
                    {pending.length > 0 && (
                        <p className="faint" style={{ fontSize: ".82rem", marginTop: 12 }}>
                            Waiting on an answer: {pending.map(u => u.username).join(", ")}
                        </p>
                    )}
                </section>

                <div className="row wrap">
                    <button onClick={handleLeaveGroup} className="btn btn-ghost btn-sm">Leave group</button>
                    {isAdmin && (
                        <button onClick={handleDeleteGroup} className="btn btn-danger btn-sm">Delete group</button>
                    )}
                </div>
            </main>
        </>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<main className="container page"><div className="empty">Loading…</div></main>}>
            <GroupView />
        </Suspense>
    );
}
