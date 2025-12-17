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

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        } else if (user) {
            setGroups(StorageService.getUserGroups(user.id));
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return <div className="container" style={{ padding: "2rem" }}>Loading...</div>;
    }

    return (
        <div className="container" style={{ padding: "2rem 1rem" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
                <div>
                    <div>
                        <h1 style={{ fontSize: "2rem" }}>Dashboard</h1>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                            <p style={{ color: "var(--muted)" }}>Welcome back, {user.username}</p>
                            <Link href="/profile" style={{ fontSize: "0.875rem", color: "var(--primary)" }}>Profile</Link>
                        </div>
                    </div>        </div>
                <Link href="/groups/create" className="btn btn-primary">
                    + New Group
                </Link>
            </header>

            {groups.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
                    <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>You haven't joined any groups yet.</p>
                    <Link href="/groups/create" className="btn" style={{ background: "var(--muted-light)" }}>Create a Group</Link>
                </div>
            ) : (
                <div style={{ display: "grid", gap: "1rem" }}>
                    {groups.map((group) => (
                        <Link key={group.id} href={`/groups/${group.id}`} className="card" style={{ display: "block", transition: "transform 0.2s" }}>
                            <h3 style={{ fontSize: "1.25rem", marginBottom: "0.25rem" }}>{group.name}</h3>
                            <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
                                {group.members.length} members
                            </p>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
