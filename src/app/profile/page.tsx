"use client";

import { useAuth } from "@/context/AuthContext";
import { StorageService } from "@/services/StorageService";
import { GOOGLE_APPS_SCRIPT_SOURCE } from "@/data/googleAppsScript";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProfilePage() {
    const { user, logout, loading } = useAuth();
    const router = useRouter();

    const [showDelete, setShowDelete] = useState(false);
    const [delPassword, setDelPassword] = useState("");
    const [delError, setDelError] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [showScript, setShowScript] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!loading && !user) router.push("/login");
    }, [loading, user, router]);

    // Derived, not stored: this render only happens client-side once a user exists,
    // so reading localStorage here cannot desync from the server-rendered markup.
    const groupCount = user ? StorageService.getUserGroups(user.id).length : 0;

    const closeDelete = () => {
        setShowDelete(false);
        setDelPassword("");
        setDelError("");
    };

    const handleDelete = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setIsDeleting(true);
        setDelError("");
        try {
            // The username comes from the session, so only the signed-in account can be
            // deleted here; the password is still required as confirmation.
            await StorageService.deleteAccount(user.username, delPassword);
            logout(); // deleteAccount cleared the stored session; drop the in-memory user too.
        } catch (err) {
            setDelError(err instanceof Error ? err.message : "Failed to delete account");
            setIsDeleting(false);
        }
    };

    if (loading || !user) return null;

    return (
        <>
            <main className="container page" style={{ maxWidth: 560 }}>
                <Link href="/dashboard" className="back">← Back to dashboard</Link>

                <div className="card" style={{ textAlign: "center", padding: "36px 28px" }}>
                    <div className="avatar avatar-lg" style={{ margin: "0 auto 18px" }}>
                        {user.username.charAt(0).toUpperCase()}
                    </div>

                    <h1 style={{ fontSize: "1.7rem" }}>{user.username}</h1>
                    <p className="faint" style={{ fontSize: ".875rem", marginTop: 6 }}>
                        Member since {new Date(user.createdAt).toLocaleDateString()} · {groupCount} group{groupCount === 1 ? "" : "s"}
                    </p>

                    <div className="row wrap" style={{ justifyContent: "center", marginTop: 26 }}>
                        <button onClick={logout} className="btn btn-outline">Log out</button>
                        {!showDelete && (
                            <button type="button" onClick={() => setShowDelete(true)} className="btn btn-danger">
                                Delete account
                            </button>
                        )}
                    </div>

                    {showDelete && (
                        <form onSubmit={handleDelete} className="stack-lg" style={{ marginTop: 26, paddingTop: 22, borderTop: "1px solid var(--line)", textAlign: "left" }}>
                            <div>
                                <h2 style={{ fontSize: "1rem", color: "var(--red)" }}>Delete account</h2>
                                <p className="faint" style={{ fontSize: ".82rem", lineHeight: 1.55, marginTop: 8 }}>
                                    This permanently removes <strong>{user.username}</strong> and frees the username
                                    for anyone to claim. You&apos;ll be dropped from your groups, but the expenses stay,
                                    so nobody else&apos;s balances change. This cannot be undone.
                                </p>
                            </div>

                            <div className="field">
                                <label className="label" htmlFor="delpass">Confirm your password</label>
                                <input
                                    id="delpass"
                                    type="password"
                                    className="input"
                                    value={delPassword}
                                    onChange={e => setDelPassword(e.target.value)}
                                    autoComplete="current-password"
                                    required
                                    placeholder="••••••••"
                                />
                            </div>

                            {delError && <p className="notice notice-error">{delError}</p>}

                            <div className="row">
                                <button type="button" onClick={closeDelete} className="btn btn-ghost grow" disabled={isDeleting}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-danger grow" disabled={isDeleting}>
                                    {isDeleting ? <><span className="spin" /> Deleting…</> : "Delete forever"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* The server script used to live on the create-group page, which no longer
                    asks for one. It still has to be reachable to set up or update a sheet. */}
                <p style={{ textAlign: "center", marginTop: 20 }}>
                    <button type="button" className="link-btn" onClick={() => setShowScript(true)}>
                        View the Google Apps Script
                    </button>
                </p>
            </main>

            {showScript && (
                <div
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setShowScript(false)}
                    style={{
                        position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
                        display: "grid", placeItems: "center", padding: 20, zIndex: 100
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="card"
                        style={{ width: "100%", maxWidth: 860, maxHeight: "88vh", display: "flex", flexDirection: "column", gap: 14 }}
                    >
                        <div className="row-between">
                            <h3 style={{ fontSize: "1.05rem" }}>Google Apps Script</h3>
                            <div className="row">
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => {
                                        navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_SOURCE);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }}
                                >
                                    {copied ? "Copied ✓" : "Copy code"}
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowScript(false)}>Close</button>
                            </div>
                        </div>
                        <p className="faint" style={{ fontSize: ".82rem" }}>
                            Paste this into your sheet&apos;s Apps Script editor, run <code>setup</code> once, then
                            deploy as a web app with &ldquo;Execute as: Me&rdquo; and &ldquo;Who has access: Anyone&rdquo;.
                        </p>
                        <pre style={{
                            flex: 1, overflow: "auto", margin: 0, padding: "18px 20px",
                            borderRadius: 14, background: "#16181d", color: "#e6e8ec",
                            fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.7
                        }}>
                            {GOOGLE_APPS_SCRIPT_SOURCE}
                        </pre>
                    </div>
                </div>
            )}
        </>
    );
}
