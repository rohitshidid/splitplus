"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProfilePage() {
    const { user, logout, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) router.push("/login");
    }, [loading, user, router]);

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

                <button onClick={logout} className="btn" style={{ background: "var(--error)", color: "white", padding: "0.75rem 2rem" }}>
                    Log Out
                </button>
            </div>
        </div>
    );
}
