"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function LoginPage() {
    const { login } = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");
        try {
            await login(username, password);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to log in");
            setIsSubmitting(false);
        }
    };

    return (
        <div className="landing">
            <nav className="lnav stuck">
                <div className="container container-wide lnav-in">
                    <Link href="/" className="brand">
                        <span className="brand-mark">S</span>
                        Splitplus
                    </Link>
                    <div className="lnav-links">
                        <Link href="/">What is Splitplus?</Link>
                        <Link href="/signup" className="btn btn-primary btn-sm">Sign up</Link>
                    </div>
                </div>
            </nav>

        <main className="auth-shell">
            <div className="auth-card">

                <div className="card">
                    <h2 style={{ fontSize: "1.4rem", textAlign: "center" }}>Welcome back</h2>
                    <p className="muted" style={{ textAlign: "center", fontSize: ".9rem", marginTop: 6, marginBottom: 22 }}>
                        Your groups are waiting, whichever device this is.
                    </p>

                    <form onSubmit={handleSubmit} className="stack-lg">
                        <div className="field">
                            <label className="label" htmlFor="username">Username</label>
                            <input
                                id="username"
                                type="text"
                                className="input"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                autoComplete="username"
                                required
                                placeholder="e.g. alice"
                            />
                        </div>

                        <div className="field">
                            <label className="label" htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                className="input"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="current-password"
                                required
                                placeholder="••••••••"
                            />
                        </div>

                        {error && <p className="notice notice-error">{error}</p>}

                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? <><span className="spin" /> Logging in…</> : "Log in"}
                        </button>
                    </form>
                </div>

                <p className="muted" style={{ marginTop: 20, textAlign: "center", fontSize: ".9rem" }}>
                    Don&apos;t have an account? <Link href="/signup" style={{ fontWeight: 550 }}>Sign up</Link>
                </p>
            </div>
        </main>
        </div>
    );
}
