"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { StorageService } from "@/services/StorageService";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User } from "@/types";
import AppBar from "@/components/AppBar";

export default function CreateGroupPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [name, setName] = useState("");
    const [memberUsername, setMemberUsername] = useState("");
    const [addedMembers, setAddedMembers] = useState<User[]>([]);
    const [error, setError] = useState("");
    const [lookingUp, setLookingUp] = useState(false);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!loading && !user) router.push("/login");
    }, [user, loading, router]);

    const addMember = async (e: React.FormEvent) => {
        e.preventDefault();
        const wanted = memberUsername.trim();
        if (!wanted) return;

        if (wanted.toLowerCase() === user?.username.toLowerCase()) {
            setError("You're in the group already — that's the point.");
            return;
        }

        setLookingUp(true);
        setError("");
        try {
            // Remote lookup: people usually signed up on their own device.
            const found = await StorageService.findUserByUsernameRemote(wanted);
            if (!found) {
                setError(`No account called "${wanted}".`);
                return;
            }
            if (addedMembers.some(m => m.id === found.id)) {
                setError("Already on the list.");
                return;
            }
            setAddedMembers([...addedMembers, found]);
            setMemberUsername("");
        } finally {
            setLookingUp(false);
        }
    };

    const removeMember = (id: string) =>
        setAddedMembers(addedMembers.filter(m => m.id !== id));

    const handleCreate = async () => {
        if (!user) return;
        if (!name.trim()) {
            setError("Give the group a name.");
            return;
        }

        setCreating(true);
        setError("");
        try {
            const group = await StorageService.createGroup(
                name.trim(),
                addedMembers.map(m => m.id),
                user.id
            );
            router.push(`/groups/view?id=${group.id}`);
        } catch {
            setError("Couldn't create the group. Check your connection and try again.");
            setCreating(false);
        }
    };

    if (loading || !user) return null;

    return (
        <>
            <AppBar />
            <main className="container page" style={{ maxWidth: 560 }}>
                <Link href="/dashboard" className="back">← Back to dashboard</Link>
                <h1 style={{ fontSize: "1.7rem", marginBottom: 22 }}>New group</h1>

                <div className="card stack-lg">
                    <div className="field">
                        <label className="label" htmlFor="gname">Group name</label>
                        <input
                            id="gname"
                            className="input"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Lisbon, four of us"
                        />
                    </div>

                    <div className="field">
                        <label className="label" htmlFor="member">Invite members</label>
                        <form onSubmit={addMember} className="row">
                            <input
                                id="member"
                                className="input grow"
                                value={memberUsername}
                                onChange={e => setMemberUsername(e.target.value)}
                                placeholder="Their username"
                            />
                            <button type="submit" className="btn btn-outline" disabled={lookingUp}>
                                {lookingUp ? <span className="spin" /> : "Add"}
                            </button>
                        </form>
                        <p className="faint" style={{ fontSize: ".78rem" }}>
                            They&apos;ll get an invite to accept — you can also do this later.
                        </p>
                    </div>

                    {addedMembers.length > 0 && (
                        <div className="stack">
                            {addedMembers.map(m => (
                                <div key={m.id} className="row" style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
                                    <span className="avatar" style={{ width: 26, height: 26, fontSize: ".75rem" }}>
                                        {m.username.charAt(0).toUpperCase()}
                                    </span>
                                    <span className="grow">{m.username}</span>
                                    <button onClick={() => removeMember(m.id)} className="link-btn" style={{ color: "var(--red)" }}>
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {error && <p className="notice notice-error">{error}</p>}

                    <button onClick={handleCreate} className="btn btn-primary" disabled={creating}>
                        {creating ? <><span className="spin" /> Creating…</> : "Create group"}
                    </button>
                </div>
            </main>
        </>
    );
}
