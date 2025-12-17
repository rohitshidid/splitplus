"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { StorageService } from "@/services/StorageService";
import { useRouter } from "next/navigation";
import { User } from "@/types";

export default function CreateGroupPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [name, setName] = useState("");
    const [memberUsername, setMemberUsername] = useState("");
    const [addedMembers, setAddedMembers] = useState<User[]>([]); // To display names
    const [memberIds, setMemberIds] = useState<string[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!loading && !user) router.push("/login");
    }, [user, loading, router]);

    const addMember = (e: React.FormEvent) => {
        e.preventDefault();
        if (!memberUsername) return;

        if (memberUsername.toLowerCase() === user?.username.toLowerCase()) {
            setError("You are automatically added to the group.");
            return;
        }

        const foundUser = StorageService.findUserByUsername(memberUsername);
        if (!foundUser) {
            setError("User not found.");
            return;
        }

        if (memberIds.includes(foundUser.id)) {
            setError("User already added.");
            return;
        }

        setAddedMembers([...addedMembers, foundUser]);
        setMemberIds([...memberIds, foundUser.id]);
        setMemberUsername("");
        setError("");
    };

    const removeMember = (id: string) => {
        setMemberIds(memberIds.filter(m => m !== id));
        setAddedMembers(addedMembers.filter(m => m.id !== id));
    };

    const handleCreate = () => {
        if (!user) return;
        if (!name.trim()) {
            setError("Group name is required.");
            return;
        }

        try {
            StorageService.createGroup(name, memberIds, user.id);
            router.push("/dashboard");
        } catch (err) {
            setError("Failed to create group.");
        }
    };

    if (loading || !user) return null;

    return (
        <div className="container" style={{ padding: "2rem 1rem", maxWidth: "500px" }}>
            <h1 style={{ fontSize: "1.75rem", marginBottom: "1.5rem" }}>Create New Group</h1>

            <div className="card">
                <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Group Name</label>
                    <input
                        type="text"
                        className="input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Hawaii Trip"
                    />
                </div>

                <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Add Members</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <input
                            type="text"
                            className="input"
                            value={memberUsername}
                            onChange={(e) => setMemberUsername(e.target.value)}
                            placeholder="Username"
                        />
                        <button onClick={addMember} className="btn" style={{ background: "var(--muted-light)" }}>Add</button>
                    </div>
                    {error && <p style={{ color: "var(--error)", fontSize: "0.875rem", marginTop: "0.5rem" }}>{error}</p>}
                </div>

                {addedMembers.length > 0 && (
                    <div style={{ marginBottom: "1.5rem" }}>
                        <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "0.5rem" }}>Members:</p>
                        <ul style={{ listStyle: "none" }}>
                            {addedMembers.map((m) => (
                                <li key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem", borderBottom: "1px solid var(--muted-light)" }}>
                                    <span>{m.username}</span>
                                    <button onClick={() => removeMember(m.id)} style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", fontSize: "0.875rem" }}>Remove</button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <button onClick={handleCreate} className="btn btn-primary" style={{ width: "100%" }}>Create Group</button>
            </div>
        </div>
    );
}
