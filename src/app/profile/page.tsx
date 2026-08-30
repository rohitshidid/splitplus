"use client";

import { useAuth } from "@/context/AuthContext";
import { StorageService } from "@/services/StorageService";
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

    useEffect(() => {
        if (!loading && !user) router.push("/login");
    }, [loading, user, router]);

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
            // The username comes from the session, so only the signed-in account can
            // be deleted here; the password is still required as confirmation.
            await StorageService.deleteAccount(user.username, delPassword);
            // deleteAccount already cleared the session; drop the in-memory user too.
            logout();
        } catch (err: any) {
            setDelError(err.message || "Failed to delete account");
            setIsDeleting(false);
        }
    };

    if (loading || !user) return null;

    return (
        <div className="container" style={{ padding: "2rem 1rem" }}>
            <Link href="/dashboard" style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1rem", display: "inline-block" }}>
                ← Back to Dashboard
            </Link>

            <div className="card" style={{ maxWidth: "500px", margin: "0 auto", textAlign: "center", padding: "3rem" }}>
                <div style={{ width: "80px", height: "80px", background: "var(--primary)", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 1.5rem" }}>
                    {user.username.charAt(0).toUpperCase()}
                </div>

                <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{user.username}</h1>
                <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>Member since {new Date(user.createdAt).toLocaleDateString()}</p>

                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={logout} className="btn" style={{ background: "var(--error)", color: "white", padding: "0.75rem 2rem" }}>
                        Log Out
                    </button>
                    {!showDelete && (
                        <button
                            type="button"
                            onClick={() => setShowDelete(true)}
                            className="btn"
                            style={{ background: "var(--muted-light)", color: "var(--error)", padding: "0.75rem 2rem", border: "1px solid var(--error)" }}
                        >
                            Delete Account
                        </button>
                    )}
                </div>

                {showDelete && (
                    <form onSubmit={handleDelete} style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: "0.75rem", textAlign: "left" }}>
                        <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--error)" }}>Delete account</h2>
                        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.5 }}>
                            This permanently removes <strong>{user.username}</strong> and frees the username
                            for anyone to claim. Existing groups and expenses are kept, so nobody else&apos;s
                            balances change. This cannot be undone.
                        </p>

                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 500 }}>Confirm your password</label>
                            <input
                                type="password"
                                className="input"
                                value={delPassword}
                                onChange={(e) => setDelPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                            />
                        </div>

                        {delError && <p style={{ color: "var(--error)", fontSize: "0.875rem" }}>{delError}</p>}

                        <div style={{ display: "flex", gap: "0.75rem" }}>
                            <button
                                type="button"
                                onClick={closeDelete}
                                className="btn"
                                style={{ flex: 1, background: "var(--muted-light)", color: "var(--foreground)" }}
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn"
                                style={{ flex: 1, background: "var(--error)", color: "#ffffff" }}
                                disabled={isDeleting}
                            >
                                {isDeleting ? "Deleting..." : "Delete forever"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
