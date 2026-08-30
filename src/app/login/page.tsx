"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { StorageService } from "@/services/StorageService";
import Link from "next/link";

export default function LoginPage() {
    const { login } = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Account deletion lives here because it has to work without being logged in.
    const [showDelete, setShowDelete] = useState(false);
    const [delUsername, setDelUsername] = useState("");
    const [delPassword, setDelPassword] = useState("");
    const [delError, setDelError] = useState("");
    const [delNotice, setDelNotice] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    const closeDelete = () => {
        setShowDelete(false);
        setDelUsername("");
        setDelPassword("");
        setDelError("");
    };

    const handleDelete = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsDeleting(true);
        setDelError("");
        setDelNotice("");
        try {
            await StorageService.deleteAccount(delUsername, delPassword);
            setDelNotice(`Account "${delUsername}" was deleted. That username is free again.`);
            closeDelete();
        } catch (err: any) {
            setDelError(err.message || "Failed to delete account");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");
        try {
            await login(username, password);
        } catch (err: any) {
            setError(err.message || "Failed to login");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
            <div className="card" style={{ width: "100%", maxWidth: "400px" }}>
                <h1 style={{ fontSize: "1.5rem", textAlign: "center", marginBottom: "1.5rem" }}>Login to Splitplus</h1>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 500 }}>Username</label>
                        <input
                            type="text"
                            className="input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            placeholder="e.g. alice"
                        />
                    </div>

                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 500 }}>Password</label>
                        <input
                            type="password"
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                        />
                    </div>

                    {error && <p style={{ color: "var(--error)", fontSize: "0.875rem" }}>{error}</p>}

                    <button type="submit" className="btn btn-primary" style={{ marginTop: "0.5rem" }} disabled={isSubmitting}>
                        {isSubmitting ? "Logging in..." : "Login"}
                    </button>
                </form>

                <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.875rem", color: "var(--muted)" }}>
                    Don't have an account? <Link href="/signup" style={{ color: "var(--primary)", fontWeight: 500 }}>Sign up</Link>
                </p>

                {delNotice && (
                    <p style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.875rem", color: "var(--success)" }}>
                        {delNotice}
                    </p>
                )}

                <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--card-border)" }}>
                    {!showDelete ? (
                        <button
                            type="button"
                            onClick={() => { setShowDelete(true); setDelNotice(""); }}
                            style={{ display: "block", margin: "0 auto", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "0.875rem", color: "var(--muted)", textDecoration: "underline" }}
                        >
                            Delete my account
                        </button>
                    ) : (
                        <form onSubmit={handleDelete} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--error)" }}>Delete account</h2>
                            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.5 }}>
                                This permanently removes the account and frees the username for anyone to
                                claim. Existing groups and expenses are kept, so nobody else's balances
                                change. This cannot be undone.
                            </p>

                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 500 }}>Username</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={delUsername}
                                    onChange={(e) => setDelUsername(e.target.value)}
                                    required
                                    placeholder="Confirm your username"
                                />
                            </div>

                            <div>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 500 }}>Password</label>
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
        </main>
    );
}
