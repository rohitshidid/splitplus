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
            </div>
        </main>
    );
}
