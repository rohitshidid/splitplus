"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { StorageService } from "@/services/StorageService";
import AppBar from "@/components/AppBar";
import Link from "next/link";
import { useRouter } from "next/navigation";

const POLL_MS = 20_000;

export default function DashboardPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [joinGroupId, setJoinGroupId] = useState("");
    const [joinMsg, setJoinMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [joining, setJoining] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [busyInvite, setBusyInvite] = useState<string | null>(null);
    const [firstLoad, setFirstLoad] = useState(true);

    // Bumped whenever the cache behind the lists has changed. Deriving the lists
    // during render (rather than mirroring them into state from an effect) keeps
    // localStorage as the single source and avoids a render-then-correct flash.
    const [revision, setRevision] = useState(0);
    const refreshData = useCallback(() => setRevision(r => r + 1), []);

    const userId = user?.id;
    // `revision` is the cache-busting key, not a value the bodies read - the lint
    // rule can't see that the real dependency is localStorage.
    /* eslint-disable react-hooks/exhaustive-deps */
    const groups = useMemo(
        () => (userId ? StorageService.getUserGroups(userId) : []),
        [userId, revision]
    );
    const invites = useMemo(
        () => (userId ? StorageService.getPendingInvites(userId) : []),
        [userId, revision]
    );
    /* eslint-enable react-hooks/exhaustive-deps */

    // A ref so the poll interval always calls the current closure without having to
    // tear itself down and resubscribe on every render.
    const syncRef = useRef<() => Promise<void>>(async () => {});
    useEffect(() => {
        syncRef.current = async () => {
            if (!userId) return;
            setSyncing(true);
            await StorageService.syncAll(userId);
            setSyncing(false);
            setFirstLoad(false);
            refreshData();
        };
    });

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
            return;
        }
        if (!userId) return;

        syncRef.current();

        // Invites are sent from someone else's device, so the only way one "pops up"
        // here is to keep asking. Paused while the tab is hidden.
        const id = setInterval(() => {
            if (document.visibilityState === "visible") syncRef.current();
        }, POLL_MS);

        const onVisible = () => { if (document.visibilityState === "visible") syncRef.current(); };
        document.addEventListener("visibilitychange", onVisible);

        return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
    }, [userId, user, loading, router, refreshData]);

    const handleJoinRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinGroupId.trim() || !userId) return;

        setJoining(true);
        setJoinMsg(null);
        const result = await StorageService.requestJoin(joinGroupId.trim(), userId);
        setJoinMsg({ ok: result.ok, text: result.message });
        if (result.ok) setJoinGroupId("");
        setJoining(false);
        refreshData();
    };

    const handleInviteAction = async (groupId: string, accept: boolean) => {
        if (!userId) return;
        setBusyInvite(groupId);
        if (accept) await StorageService.acceptInvite(groupId, userId);
        else await StorageService.declineInvite(groupId, userId);
        setBusyInvite(null);
        refreshData();
    };

    if (loading || !user) return null;

    return (
        <>
            <AppBar
                right={
                    <>
                        {syncing && <span className="faint" style={{ fontSize: ".78rem" }}>syncing…</span>}
                        <Link href="/profile" className="btn btn-outline btn-sm">Profile</Link>
                    </>
                }
            />

            <main className="container page">
                <header className="page-head">
                    <h1>Hi, {user.username} 👋</h1>
                    <p className="muted" style={{ marginTop: 6 }}>Here&apos;s where everything stands.</p>
                </header>

                {/* Pending invites: the only place an invited user is told about a group */}
                {invites.length > 0 && (
                    <section className="card card-accent" style={{ marginBottom: 22 }}>
                        <div className="row" style={{ marginBottom: 14 }}>
                            <span className="eyebrow">Invites</span>
                            <span className="pill pill-green">{invites.length} waiting</span>
                        </div>
                        <div className="stack">
                            {invites.map(g => (
                                <div key={g.id} className="row-between wrap">
                                    <div className="row">
                                        <span className="avatar">{g.name.charAt(0).toUpperCase()}</span>
                                        <span>
                                            <strong>{g.name}</strong>
                                            <span className="faint" style={{ display: "block", fontSize: ".8rem" }}>
                                                {g.members.length} member{g.members.length === 1 ? "" : "s"} already in
                                            </span>
                                        </span>
                                    </div>
                                    <div className="row">
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => handleInviteAction(g.id, true)}
                                            disabled={busyInvite === g.id}
                                        >
                                            {busyInvite === g.id ? <span className="spin" /> : "Accept"}
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => handleInviteAction(g.id, false)}
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

                <div className="row-between" style={{ marginBottom: 14 }}>
                    <h2 style={{ fontSize: "1.35rem" }}>Your groups</h2>
                    <Link href="/groups/create" className="btn btn-primary btn-sm">+ New group</Link>
                </div>

                <div className="stack" style={{ marginBottom: 30 }}>
                    {groups.length === 0 ? (
                        <div className="empty">
                            {firstLoad && syncing ? (
                                <p><span className="spin" style={{ verticalAlign: "-2px", marginRight: 8 }} /> Loading your groups…</p>
                            ) : (
                                <>
                                    <p>No groups yet.</p>
                                    <p style={{ marginTop: 8 }}>
                                        <Link href="/groups/create">Create one</Link> — or ask a friend to invite you by username.
                                    </p>
                                </>
                            )}
                        </div>
                    ) : (
                        groups.map(g => (
                            <Link href={`/groups/view?id=${g.id}`} key={g.id} style={{ color: "inherit" }}>
                                <div className="card card-tight card-hover row">
                                    <span className="avatar">{g.name.charAt(0).toUpperCase()}</span>
                                    <span className="grow">
                                        <span style={{ fontWeight: 600, display: "block" }}>{g.name}</span>
                                        <span className="faint" style={{ fontSize: ".8rem" }}>
                                            {g.members.length} member{g.members.length === 1 ? "" : "s"}
                                            {g.pendingMembers.length > 0 && ` · ${g.pendingMembers.length} invited`}
                                            {g.createdBy === user.id && " · you're the admin"}
                                        </span>
                                    </span>
                                    <span className="faint">→</span>
                                </div>
                            </Link>
                        ))
                    )}
                </div>

                <section className="card">
                    <h3 style={{ fontSize: "1rem" }}>Join with a group ID</h3>
                    <p className="faint" style={{ fontSize: ".84rem", margin: "6px 0 14px" }}>
                        Paste an ID someone sent you. The admin gets a request to approve.
                    </p>
                    <form onSubmit={handleJoinRequest} className="row">
                        <input
                            className="input grow"
                            placeholder="Group ID"
                            value={joinGroupId}
                            onChange={e => setJoinGroupId(e.target.value)}
                        />
                        <button type="submit" className="btn btn-outline" disabled={joining}>
                            {joining ? <span className="spin" /> : "Join"}
                        </button>
                    </form>
                    {joinMsg && (
                        <p className={`notice ${joinMsg.ok ? "notice-ok" : "notice-error"}`} style={{ marginTop: 10 }}>
                            {joinMsg.text}
                        </p>
                    )}
                </section>
            </main>
        </>
    );
}
