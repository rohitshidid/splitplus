"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { StorageService } from "@/services/StorageService";
import { Group, Expense, User } from "@/types";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function GroupPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const groupId = params.groupId as string;

    const [group, setGroup] = useState<Group | null>(null);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [members, setMembers] = useState<User[]>([]);
    const [isAdding, setIsAdding] = useState(false);

    // Add Expense Form
    const [desc, setDesc] = useState("");
    const [amount, setAmount] = useState("");
    const [paidBy, setPaidBy] = useState("");

    // Split Logic
    const [splitType, setSplitType] = useState<"EQUAL" | "EXACT" | "PERCENTAGE">("EQUAL");
    const [splitInputs, setSplitInputs] = useState<Record<string, string>>({}); // userID -> value (amount or %)

    const [error, setError] = useState("");

    const refreshData = () => {
        if (!groupId) return;
        const g = StorageService.getGroups().find(g => g.id === groupId);
        if (!g) {
            router.push("/dashboard");
            return;
        }
        setGroup(g);
        setExpenses(StorageService.getGroupExpenses(groupId));
        setMembers(StorageService.getUsers().filter(u => g.members.includes(u.id)));
    };

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        } else {
            refreshData();
        }
    }, [user, loading, groupId, router]);

    // Compute Balances
    const balances = useMemo(() => {
        const bal: Record<string, number> = {};
        members.forEach(m => bal[m.id] = 0);

        expenses.forEach(e => {
            const payer = e.paidBy;
            const totalAmount = e.amount;

            // Handle legacy data if any
            const splits = e.splits || [];
            const splitAmong = (e as any).splitAmong || []; // Fallback

            // Credit payer
            bal[payer] = (bal[payer] || 0) + totalAmount;

            if (splits.length > 0) {
                // New schema
                splits.forEach(s => {
                    bal[s.userId] = (bal[s.userId] || 0) - s.amount;
                });
            } else if (splitAmong.length > 0) {
                // Legacy schema (Equal split)
                const share = totalAmount / splitAmong.length;
                splitAmong.forEach((uid: string) => {
                    bal[uid] = (bal[uid] || 0) - share;
                });
            }
        });

        return bal;
    }, [expenses, members]);

    const handleSplitInputChange = (userId: string, val: string) => {
        setSplitInputs(prev => ({ ...prev, [userId]: val }));
    };

    const distributeEqual = (total: number, memberIds: string[]) => {
        return memberIds.map(id => ({ userId: id, amount: total / memberIds.length }));
    };

    const handleAddExpense = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!desc || !amount || !paidBy) {
            setError("Please fill all fields");
            return;
        }
        const totalVal = parseFloat(amount);
        if (isNaN(totalVal) || totalVal <= 0) {
            setError("Invalid amount");
            return;
        }

        let finalSplits: { userId: string, amount: number }[] = [];

        if (splitType === "EQUAL") {
            finalSplits = distributeEqual(totalVal, members.map(m => m.id));
        } else if (splitType === "EXACT") {
            let sum = 0;
            finalSplits = members.map(m => {
                const val = parseFloat(splitInputs[m.id] || "0");
                sum += val;
                return { userId: m.id, amount: val };
            });

            if (Math.abs(sum - totalVal) > 0.01) {
                setError(`split amounts ($${sum}) do not match total ($${totalVal})`);
                return;
            }
        } else if (splitType === "PERCENTAGE") {
            let sum = 0;
            finalSplits = members.map(m => {
                const pct = parseFloat(splitInputs[m.id] || "0");
                sum += pct;
                return { userId: m.id, amount: (pct / 100) * totalVal };
            });

            if (Math.abs(sum - 100) > 0.1) {
                setError(`percentages (${sum}%) do not sum to 100%`);
                return;
            }
        }

        StorageService.addExpense(groupId, desc, totalVal, paidBy, finalSplits, splitType);

        // Reset
        setDesc("");
        setAmount("");
        setIsAdding(false);
        setSplitInputs({});
        setSplitType("EQUAL");
        refreshData();
    };

    if (loading || !group) return <div className="container p-4">Loading...</div>;

    return (
        <div className="container" style={{ padding: "2rem 1rem" }}>
            <Link href="/dashboard" style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1rem", display: "inline-block" }}>
                ← Back to Dashboard
            </Link>

            <header style={{ marginBottom: "2rem" }}>
                <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{group.name}</h1>
                <p style={{ color: "var(--muted)" }}>Group ID: {group.id.slice(0, 8)}...</p>
            </header>

            {/* Balances Section */}
            <section style={{ marginBottom: "2rem" }}>
                <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>Balances</h2>
                <div style={{ display: "grid", gap: "0.5rem" }}>
                    {members.map(m => {
                        const b = balances[m.id] || 0;
                        const isOwed = b > 0.01;
                        const isOwing = b < -0.01;
                        const color = isOwed ? "var(--success)" : isOwing ? "var(--error)" : "var(--muted)";
                        const text = isOwed ? `gets back $${b.toFixed(2)}` : isOwing ? `owes $${Math.abs(b).toFixed(2)}` : "settled up";

                        return (
                            <div key={m.id} className="card" style={{ padding: "1rem", display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontWeight: 500 }}>{m.username} {m.id === user?.id && "(You)"}</span>
                                <span style={{ color, fontWeight: 600 }}>{text}</span>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Expenses List */}
            <section>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h2 style={{ fontSize: "1.25rem" }}>Expenses</h2>
                    <button onClick={() => setIsAdding(!isAdding)} className="btn btn-primary" style={{ fontSize: "0.875rem" }}>
                        {isAdding ? "Cancel" : "+ Add Expense"}
                    </button>
                </div>

                {isAdding && (
                    <div className="card" style={{ marginBottom: "2rem", background: "var(--muted-light)", border: "none" }}>
                        <form onSubmit={handleAddExpense} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <input
                                className="input"
                                placeholder="Description (e.g. Dinner)"
                                value={desc}
                                onChange={e => setDesc(e.target.value)}
                            />
                            <div style={{ display: "flex", gap: "1rem" }}>
                                <input
                                    type="number"
                                    className="input"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <select
                                    className="input"
                                    value={paidBy}
                                    onChange={e => setPaidBy(e.target.value)}
                                    style={{ flex: 1 }}
                                >
                                    <option value="">Paid by...</option>
                                    {members.map(m => (
                                        <option key={m.id} value={m.id}>{m.username}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Split Type Selector */}
                            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                                {(["EQUAL", "EXACT", "PERCENTAGE"] as const).map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setSplitType(type)}
                                        className="btn"
                                        style={{
                                            flex: 1,
                                            fontSize: "0.75rem",
                                            background: splitType === type ? "var(--primary)" : "var(--card-bg)",
                                            color: splitType === type ? "white" : "var(--foreground)",
                                            border: "1px solid var(--card-border)"
                                        }}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>

                            {/* Dynamic Inputs for Split */}
                            {splitType !== "EQUAL" && (
                                <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem" }}>
                                    {members.map(m => (
                                        <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.875rem" }}>
                                            <span>{m.username}</span>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                <input
                                                    type="number"
                                                    className="input"
                                                    style={{ width: "80px", padding: "0.5rem" }}
                                                    value={splitInputs[m.id] || ""}
                                                    onChange={(e) => handleSplitInputChange(m.id, e.target.value)}
                                                    placeholder="0"
                                                />
                                                <span>{splitType === "PERCENTAGE" ? "%" : "$"}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {error && <p style={{ color: "var(--error)", fontSize: "0.875rem" }}>{error}</p>}
                            <button type="submit" className="btn btn-primary">Save Expense</button>
                        </form>
                    </div>
                )}

                <div style={{ display: "grid", gap: "0.5rem" }}>
                    {expenses.length === 0 ? (
                        <p style={{ color: "var(--muted)", fontStyle: "italic" }}>No expenses yet.</p>
                    ) : (
                        expenses.map(e => {
                            const payerName = members.find(m => m.id === e.paidBy)?.username || "Unknown";
                            const typeLabel = e.splitType && e.splitType !== "EQUAL" ? `(${e.splitType})` : "";
                            return (
                                <div key={e.id} className="card" style={{ padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <p style={{ fontWeight: 500 }}>{e.description} <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{typeLabel}</span></p>
                                        <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{payerName} paid ${e.amount.toFixed(2)}</p>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <p style={{ fontSize: "0.875rem", fontWeight: 600 }}>${e.amount.toFixed(2)}</p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </section>
        </div>
    );
}
