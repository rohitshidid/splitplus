"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function SignupPage() {
    const { signup } = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");
        try {
            await signup(username, password);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to sign up");
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
                        <Link href="/login" className="btn btn-primary btn-sm">Log in</Link>
                    </div>
                </div>
            </nav>

        <main className="auth-shell">
            <div className="auth-card">

                <div className="card">
                    <h2 style={{ fontSize: "1.4rem", textAlign: "center" }}>Create your account</h2>
                    <p className="muted" style={{ textAlign: "center", fontSize: ".9rem", marginTop: 6, marginBottom: 22 }}>
                        A username and a password. That&apos;s the whole form.
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
                                placeholder="e.g. bob"
                            />
                            <p className="faint" style={{ fontSize: ".78rem" }}>This is how friends invite you to a group.</p>
                        </div>

                        <div className="field">
                            <label className="label" htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                className="input"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="new-password"
                                required
                                placeholder="••••••••"
                            />
                        </div>

                        {error && <p className="notice notice-error">{error}</p>}

                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? <><span className="spin" /> Creating account…</> : "Sign up"}
                        </button>
                    </form>
                </div>

                <p className="muted" style={{ marginTop: 20, textAlign: "center", fontSize: ".9rem" }}>
                    Already have an account? <Link href="/login" style={{ fontWeight: 550 }}>Log in</Link>
                </p>
            </div>
        </main>
        </div>
    );
}
