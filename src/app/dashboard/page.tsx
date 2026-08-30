"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { StorageService } from "@/services/StorageService";
import { Group } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [groups, setGroups] = useState<Group[]>([]);
    const [invites, setInvites] = useState<Group[]>([]);
    const [joinGroupId, setJoinGroupId] = useState("");
    const [joinMsg, setJoinMsg] = useState("");
    const [syncing, setSyncing] = useState(false);
    const [busyInvite, setBusyInvite] = useState<string | null>(null);

    const refreshData = () => {
        if (user) {
            setGroups(StorageService.getUserGroups(user.id));
            setInvites(StorageService.getPendingInvites(user.id));
        }
    };

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
            return;
        }
        if (!user) return;

        refreshData();

        // Invites arrive from another person's device, so the local copy is always
        // stale until we pull. This is also what populates a device that has only
        // just logged in.
        let cancelled = false;
        setSyncing(true);
        StorageService.syncAll(user.id).finally(() => {
            if (cancelled) return;
            setSyncing(false);
            refreshData();
        });

        return () => { cancelled = true; };
    }, [user, loading, router]);

    const handleJoinRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinGroupId.trim() || !user) return;

        // Check if valid group
        const allGroups = StorageService.getGroups();
        const target = allGroups.find(g => g.id === joinGroupId.trim() || (joinGroupId.trim().length >= 6 && g.id.startsWith(joinGroupId.trim())));

        if (!target) {
            setJoinMsg("Group not found on this device. Ask an admin to invite you by username instead.");
            return;
        }
        if (target.members.includes(user.id)) {
            setJoinMsg("You are already in this group.");
            return;
        }
        if (target.joinRequests?.includes(user.id)) {
            setJoinMsg("Request already sent.");
            return;
        }

        await StorageService.requestJoin(target.id, user.id);
        setJoinMsg("Request sent to admin!");
        setJoinGroupId("");
    };

    const handleAccept = async (groupId: string) => {
        if (!user) return;
        setBusyInvite(groupId);
        await StorageService.acceptInvite(groupId, user.id);
        setBusyInvite(null);
        refreshData();
    };

    const handleDecline = async (groupId: string) => {
        if (!user) return;
        setBusyInvite(groupId);
        await StorageService.declineInvite(groupId, user.id);
        setBusyInvite(null);
        refreshData();
    };

    if (loading || !user) return null;

    // Calculate total balance
    // Note: accurate balance requires summing up all balances across all groups.
    // For this simplified view, we might skip it or compute it if needed.
    // Let's keep it simple for now.

    return (
        <div className="container" style={{ padding: "2rem 1rem" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                <div>
                    <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Hi, {user.username} 👋</h1>
                    <p style={{ color: "var(--muted)" }}>Welcome back to Splitplus</p>
                </div>
                <Link href="/profile" className="btn" style={{ background: "var(--card-bg)", color: "var(--foreground)", border: "1px solid var(--card-border)" }}>
                    Profile
                </Link>
            </header>

            {/* Pending Invites: the only place an invited user is told about a group */}
            {invites.length > 0 && (
                <section style={{ marginBottom: "2rem", padding: "1.5rem", background: "var(--card-bg)", borderRadius: "var(--radius)", border: "1px solid var(--primary)" }}>
                    <h3 style={{ fontSize: "1rem", marginBottom: "1rem", color: "var(--primary)" }}>
                        Group invites 🔔 ({invites.length})
                    </h3>
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                        {invites.map(g => (
                            <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                                <span>
                                    <strong>{g.name}</strong>
                                    <span style={{ color: "var(--muted)", fontSize: "0.875rem" }}> invited you to join</span>
                                </span>
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <button
                                        onClick={() => handleAccept(g.id)}
                                        className="btn btn-primary"
                                        style={{ padding: "0.35rem 0.9rem", fontSize: "0.8125rem" }}
                                        disabled={busyInvite === g.id}
                                    >
                                        {busyInvite === g.id ? "..." : "Accept"}
                                    </button>
                                    <button
                                        onClick={() => handleDecline(g.id)}
                                        className="btn"
                                        style={{ padding: "0.35rem 0.9rem", fontSize: "0.8125rem", background: "var(--muted-light)" }}
                                        disabled={busyInvite === g.id}
                                    >
                                        Decline
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Join Group Section */}
            <section style={{ marginBottom: "2rem", padding: "1.5rem", background: "var(--card-bg)", borderRadius: "var(--radius)", border: "1px solid var(--card-border)" }}>
                <h3 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Join an existing group</h3>
                <form onSubmit={handleJoinRequest} style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                        className="input"
                        placeholder="Enter Group ID"
                        value={joinGroupId}
                        onChange={e => setJoinGroupId(e.target.value)}
                        style={{ flex: 1 }}
                    />
                    <button type="submit" className="btn btn-primary">Join</button>
                </form>
                {joinMsg && <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: joinMsg.includes("sent") ? "var(--success)" : "var(--error)" }}>{joinMsg}</p>}
            </section>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h2 style={{ fontSize: "1.5rem" }}>
                    Your Groups
                    {syncing && <span style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 400, marginLeft: "0.5rem" }}>syncing…</span>}
                </h2>
                <Link href="/groups/create" className="btn btn-primary">
                    + New Group
                </Link>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
                {groups.length === 0 ? (
                    <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "3rem", color: "var(--muted)", background: "var(--muted-light)", borderRadius: "var(--radius)" }}>
                        {syncing ? (
                            <p>Loading your groups…</p>
                        ) : (
                            <>
                                <p>You haven&apos;t joined any groups yet.</p>
                                <Link href="/groups/create" style={{ color: "var(--primary)", textDecoration: "underline" }}>Create one now</Link>
                            </>
                        )}
                    </div>
                ) : (
                    groups.map(group => (
                        <Link href={`/groups/view?id=${group.id}`} key={group.id} style={{ textDecoration: "none" }}>
                            <div className="card h-full hover-card">
                                <h3 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>{group.name}</h3>
                                <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>{group.members.length} Members</p>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
