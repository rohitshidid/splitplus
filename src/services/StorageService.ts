"use client";

import { User, Group, Expense, SplitType } from "../types";

// Keys for LocalStorage
const K_USERS = "splitplus_users";
const K_GROUPS = "splitplus_groups";
const K_EXPENSES = "splitplus_expenses";
const K_CURRENT_USER = "splitplus_current_user_id";

// Shown when the request never reaches the Apps Script (blocked, offline, or a
// non-CORS error page), which the browser reports only as a generic failure.
const UNREACHABLE_SHEET_MSG =
    "Couldn't reach the auth sheet. Re-deploy the Apps Script web app with " +
    "\"Execute as: Me\" and \"Who has access: Anyone\", then update NEXT_PUBLIC_AUTH_SHEET_URL.";

export const StorageService = {
    // --- Helpers ---
    _get: <T>(key: string): T[] => {
        if (typeof window === "undefined") return [];
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },

    _save: (key: string, data: any[]) => {
        if (typeof window === "undefined") return;
        localStorage.setItem(key, JSON.stringify(data));
    },

    hashPassword: async (password: string): Promise<string> => {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    },

    // --- Users ---
    getUsers: (): User[] => StorageService._get<User>(K_USERS),

    findUserByUsername: (username: string): User | undefined => {
        const users = StorageService.getUsers();
        return users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    },

    /**
     * Resolves a username to an account, consulting the global auth sheet when the
     * local cache misses. Inviting someone who signed up on a different device is
     * the normal case, so a local-only lookup would fail for almost every invite.
     */
    findUserByUsernameRemote: async (username: string): Promise<User | undefined> => {
        const local = StorageService.findUserByUsername(username);
        if (local) return local;

        const sheetUrl = process.env.NEXT_PUBLIC_AUTH_SHEET_URL;
        if (!sheetUrl) return undefined;

        try {
            const res = await fetch(sheetUrl, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "FIND_USER", payload: { username } })
            });
            const data = await res.json();
            if (data.status !== "success" || !data.user) return undefined;

            // Cache a stub so the synchronous lookups elsewhere resolve this name.
            const stub: User = { id: data.user.id, username: data.user.username, password: "", createdAt: Date.now() };
            StorageService._cacheUsers([stub]);
            return stub;
        } catch (e) {
            console.error("User lookup on auth sheet failed", e);
            return undefined;
        }
    },

    /**
     * Merges user records into the local cache without clobbering real credentials
     * with the blank password a stub carries.
     */
    _cacheUsers: (incoming: User[]) => {
        if (incoming.length === 0) return;
        const users = StorageService._get<User>(K_USERS);
        let changed = false;

        incoming.forEach(u => {
            if (!u.id) return;
            const idx = users.findIndex(existing => existing.id === u.id);
            if (idx === -1) {
                users.push(u);
                changed = true;
            } else if (users[idx].username !== u.username && u.username) {
                users[idx] = { ...users[idx], username: u.username };
                changed = true;
            }
        });

        if (changed) StorageService._save(K_USERS, users);
    },

    createUser: async (username: string, password: string): Promise<User> => {
        const authSheetUrl = process.env.NEXT_PUBLIC_AUTH_SHEET_URL;
        const hashedPassword = await StorageService.hashPassword(password);

        if (authSheetUrl) {
            // Global Auth
            let data: any;
            try {
                const res = await fetch(authSheetUrl, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({
                        action: "SIGNUP",
                        payload: { id: crypto.randomUUID(), username, password: hashedPassword }
                    })
                });
                data = await res.json();
            } catch (e: any) {
                // A blocked/errored request never reaches the script, so the browser
                // only reports a generic network failure ("Load failed" / "Failed to fetch").
                console.error("Signup request to auth sheet failed", e);
                throw new Error(UNREACHABLE_SHEET_MSG);
            }

            if (data.status === "success" && data.user) {
                const user: User = {
                    id: data.user.id,
                    username: data.user.username,
                    // Cache the hash (never the plaintext) so login works offline too.
                    password: hashedPassword,
                    createdAt: Date.now()
                };
                // Auto-login: Set session immediately
                localStorage.setItem(K_CURRENT_USER, user.id);

                // Cache user locally if needed for synchronous lookups
                let localUsers = StorageService._get<User>(K_USERS);
                if (!localUsers.find(u => u.id === user.id)) {
                    localUsers.push(user);
                    StorageService._save(K_USERS, localUsers);
                }

                return user;
            } else {
                throw new Error(data.message || "Signup failed");
            }

        } else {
            // Local Auth
            const users = StorageService.getUsers();
            if (users.find((u) => u.username.toLowerCase() === username.toLowerCase())) {
                throw new Error("Username already taken");
            }

            const newUser: User = {
                id: crypto.randomUUID(),
                username,
                password: hashedPassword,
                createdAt: Date.now(),
            };

            users.push(newUser);
            StorageService._save(K_USERS, users);

            // Auto-login
            localStorage.setItem(K_CURRENT_USER, newUser.id);

            return newUser;
        }
    },

    login: async (username: string, password: string): Promise<User> => {
        const sheetUrl = process.env.NEXT_PUBLIC_AUTH_SHEET_URL;
        const hashedPassword = await StorageService.hashPassword(password);
        let sheetUnreachable = false;

        // The sheet is the source of truth when configured: it is the only store that
        // knows about accounts created in another browser or on another device.
        if (sheetUrl) {
            let data: any = null;
            try {
                const res = await fetch(sheetUrl, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({
                        action: "LOGIN",
                        payload: { username, password: hashedPassword }
                    })
                });
                data = await res.json();
            } catch (e) {
                // Fall through to local verification so a network blip doesn't lock
                // out an account this browser already knows about.
                console.error("Login request to auth sheet failed", e);
                sheetUnreachable = true;
            }

            if (data) {
                if (data.status !== "success" || !data.user) {
                    throw new Error(data.message || "Invalid credentials");
                }

                const user: User = {
                    id: data.user.id,
                    username: data.user.username,
                    password: hashedPassword,
                    createdAt: Date.now()
                };

                // Cache locally so the synchronous lookups elsewhere resolve this user.
                const localUsers = StorageService._get<User>(K_USERS);
                const idx = localUsers.findIndex(u => u.id === user.id);
                if (idx === -1) {
                    localUsers.push(user);
                } else {
                    localUsers[idx] = { ...localUsers[idx], ...user };
                }
                StorageService._save(K_USERS, localUsers);

                localStorage.setItem(K_CURRENT_USER, user.id);
                // Awaited: a fresh device has no groups in localStorage, so returning
                // before the pull lands renders an empty dashboard.
                await StorageService.fetchUserGroups(user.id);

                return user;
            }
        }

        // Local verification: no sheet configured, or the sheet was unreachable.
        const user = StorageService.findUserByUsername(username);

        if (!user || (user.password !== hashedPassword && user.password !== password)) {
            throw new Error(sheetUnreachable ? UNREACHABLE_SHEET_MSG : "Invalid credentials");
        }

        if (user.password === password) {
            // Legacy migration: plaintext on record, replace it with the hash.
            user.password = hashedPassword;
            const all = StorageService.getUsers();
            const idx = all.findIndex(u => u.id === user.id);
            if (idx !== -1) {
                all[idx] = user;
                StorageService._save(K_USERS, all);
            }
        }

        localStorage.setItem(K_CURRENT_USER, user.id);

        // Attempt to sync groups
        await StorageService.fetchUserGroups(user.id);

        return user;
    },

    logout: () => {
        localStorage.removeItem(K_CURRENT_USER);
    },

    /**
     * Permanently deletes an account and frees its username.
     *
     * Requires the account's own password: this runs from the login page, where
     * nobody is authenticated yet. Group memberships and expenses are deliberately
     * left intact so other members' balances do not shift; the departed user simply
     * stops resolving to a name.
     */
    deleteAccount: async (username: string, password: string): Promise<void> => {
        const sheetUrl = process.env.NEXT_PUBLIC_AUTH_SHEET_URL;
        const hashedPassword = await StorageService.hashPassword(password);
        let deletedId: string;

        if (sheetUrl) {
            let data: any;
            try {
                const res = await fetch(sheetUrl, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({
                        action: "DELETE_ACCOUNT",
                        payload: { username, password: hashedPassword }
                    })
                });
                data = await res.json();
            } catch (e) {
                // Deliberately do NOT fall back to a local-only delete: the sheet row
                // would survive, keeping the username taken everywhere while the
                // account vanished from this device.
                console.error("Delete request to auth sheet failed", e);
                throw new Error(UNREACHABLE_SHEET_MSG);
            }

            if (data.status !== "success" || !data.user) {
                throw new Error(data.message || "Invalid credentials");
            }
            deletedId = data.user.id;
        } else {
            const local = StorageService.findUserByUsername(username);
            if (!local || (local.password !== hashedPassword && local.password !== password)) {
                throw new Error("Invalid credentials");
            }
            deletedId = local.id;
        }

        StorageService._purgeLocalUser(deletedId);
    },

    /** Local cleanup after the account record itself is gone. */
    _purgeLocalUser: (userId: string) => {
        // Hand any group this user created to the longest-standing remaining member,
        // so approve/reject powers stay reachable. members[] is append-ordered with
        // the creator first, making the first survivor the longest-standing one.
        const groups = StorageService.getGroups();
        const reassigned: Group[] = [];

        groups.forEach(g => {
            if (g.createdBy !== userId) return;
            const heir = g.members.find(id => id !== userId);
            if (!heir) return; // Sole member: nothing to hand off to.
            g.createdBy = heir;
            reassigned.push(g);
        });

        if (reassigned.length > 0) {
            StorageService._save(K_GROUPS, groups);
            // Push the new admin out before dropping the local user record, so the
            // group's Members tab keeps their real username rather than a placeholder.
            reassigned.forEach(g => {
                if (g.storageType === "SHEET") StorageService.syncToSheet(g);
            });
        }

        const remaining = StorageService.getUsers().filter(u => u.id !== userId);
        StorageService._save(K_USERS, remaining);

        if (localStorage.getItem(K_CURRENT_USER) === userId) {
            localStorage.removeItem(K_CURRENT_USER);
        }
    },

    getCurrentUser: (): User | null => {
        if (typeof window === "undefined") return null;
        const id = localStorage.getItem(K_CURRENT_USER);
        if (!id) return null;
        const users = StorageService.getUsers();
        return users.find((u) => u.id === id) || null;
    },

    // --- Groups ---
    createGroup: (name: string, memberIds: string[], creatorId: string, storageType: 'LOCAL' | 'SHEET' = 'LOCAL', connectionString = ""): Group => {
        const groups = StorageService.getGroups();
        const newGroup: Group = {
            id: crypto.randomUUID(),
            name,
            members: [creatorId], // Only creator is active initially
            pendingMembers: memberIds.filter(id => id !== creatorId), // Others are pending
            joinRequests: [],
            createdBy: creatorId,
            createdAt: Date.now(),
            storageType,
            connectionString
        };
        groups.push(newGroup);
        StorageService._save(K_GROUPS, groups);

        return newGroup;
    },

    /**
     * Publishes a freshly created group. Split from createGroup so the caller can
     * await the network work and only navigate once the invitees can actually see it.
     */
    publishNewGroup: async (group: Group): Promise<void> => {
        if (group.storageType === 'SHEET' && group.connectionString) {
            await StorageService.syncToSheet(group);
        }

        const link = group.storageType === 'SHEET' ? group.connectionString : undefined;

        // Everyone invited at creation time needs the link on their own row, or the
        // group never shows up in their invites.
        await StorageService.addUserGroupToGlobalSheet(group.createdBy, group.id, link);
        if (link) {
            await Promise.all(
                (group.pendingMembers || []).map(id =>
                    StorageService.addUserGroupToGlobalSheet(id, group.id, link)
                )
            );
        }
    },

    getGroups: (): Group[] => {
        const groups = StorageService._get<Group>(K_GROUPS);
        // Migration for legacy groups
        return groups.map(g => ({
            ...g,
            pendingMembers: g.pendingMembers || [],
            joinRequests: g.joinRequests || [],
            createdBy: g.createdBy || (g.members[0] || ""), // Fallback to first member
            storageType: g.storageType || 'LOCAL',
            connectionString: g.connectionString || ""
        }));
    },

    getUserGroups: (userId: string): Group[] => {
        const groups = StorageService.getGroups();
        return groups.filter(g => g.members.includes(userId));
    },

    getPendingInvites: (userId: string): Group[] => {
        const groups = StorageService.getGroups();
        return groups.filter(g => g.pendingMembers?.includes(userId));
    },

    deleteGroup: (groupId: string) => {
        // Remove Group
        let groups = StorageService.getGroups();
        const groupIndex = groups.findIndex(g => g.id === groupId);

        if (groupIndex !== -1) {
            groups.splice(groupIndex, 1);
            StorageService._save(K_GROUPS, groups);

            // Remove associated Expenses
            let expenses = StorageService.getExpenses();
            expenses = expenses.filter(e => e.groupId !== groupId);
            StorageService._save(K_EXPENSES, expenses);
        }
    },

    // --- Google Sheets Sync (Updated) ---

    syncToSheet: async (group: Group) => {
        if (group.storageType !== 'SHEET' || !group.connectionString) return;

        const allUsers = StorageService.getUsers();

        // The sheet is written wholesale, so a name this device doesn't know would be
        // overwritten with a placeholder. Read the current names first and keep them.
        const remoteNames: Record<string, string> = {};
        try {
            const res = await fetch(`${group.connectionString}?action=GET_ALL`);
            const existing = await res.json();
            (existing?.data?.members || []).forEach((m: any) => {
                if (m.id && m.username) remoteNames[m.id] = m.username;
            });
        } catch {
            // Non-fatal: fall back to whatever this device knows.
        }

        const nameFor = (id: string) =>
            allUsers.find(u => u.id === id)?.username || remoteNames[id] || "User";

        const membersPayload = [
            ...group.members.map(id => ({ id, username: nameFor(id), status: "active" })),
            ...(group.pendingMembers || []).map(id => ({ id, username: nameFor(id), status: "pending" })),
            ...(group.joinRequests || []).map(id => ({ id, username: nameFor(id), status: "requested" }))
        ];

        const payload = {
            meta: { id: group.id, name: group.name, createdBy: group.createdBy },
            members: membersPayload,
            expenses: StorageService.getGroupExpenses(group.id)
        };

        try {
            await fetch(group.connectionString, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" }, // text/plain enables simple POST without preflight
                body: JSON.stringify({ action: "SYNC_GROUP", payload })
            });
        } catch (err) {
            console.error("Failed to sync to sheet", err);
        }
    },

    syncFromSheet: async (group: Group) => {
        if (group.storageType !== 'SHEET' || !group.connectionString) return;

        let data: any;
        try {
            const res = await fetch(`${group.connectionString}?action=GET_ALL`);
            data = await res.json();
        } catch (err) {
            console.error("Failed to sync from sheet", err);
            return;
        }

        if (data.status !== "success" || !data.data) return;

        // 1. Members & status
        const sheetMembers = data.data.members || [];
        const active: string[] = [];
        const pending: string[] = [];
        const requests: string[] = [];
        const seenUsers: User[] = [];

        sheetMembers.forEach((row: any) => {
            if (!row.id) return;
            if (row.status === "active") active.push(row.id);
            else if (row.status === "pending") pending.push(row.id);
            else if (row.status === "requested") requests.push(row.id);

            seenUsers.push({ id: row.id, username: row.username, password: "", createdAt: Date.now() });
        });

        // Cached in one pass so member names render even for accounts this device
        // has never authenticated.
        StorageService._cacheUsers(seenUsers);

        const groups = StorageService.getGroups();
        let target = groups.find(g => g.id === group.id);
        if (!target) {
            // The group was pulled in mid-flight (or purged); re-add it rather than
            // dropping the data we just fetched.
            target = { ...group };
            groups.push(target);
        }

        target.members = active;
        target.pendingMembers = pending;
        target.joinRequests = requests;
        target.storageType = 'SHEET';
        target.connectionString = group.connectionString;

        const meta = data.data.meta || {};
        if (meta.name) target.name = meta.name;
        // Without this the admin controls are unreachable on a second device.
        if (meta.createdBy) target.createdBy = meta.createdBy;

        StorageService._save(K_GROUPS, groups);

        // 2. Expenses
        const remoteExpenses = (data.data.expenses || []).map((e: any) => ({
            ...e,
            amount: Number(e.amount) || 0,
            createdAt: Number(e.createdAt) || 0,
            splits: (e.splits || []).map((sp: any) => ({ userId: sp.userId, amount: Number(sp.amount) || 0 }))
        }));

        let allExpenses = StorageService.getExpenses();
        allExpenses = allExpenses.filter(e => e.groupId !== group.id);
        allExpenses.push(...remoteExpenses);
        StorageService._save(K_EXPENSES, allExpenses);
    },

    // --- Approvals & Invites ---

    requestJoin: async (groupId: string, userId: string): Promise<void> => {
        const groups = StorageService.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (!group || group.members.includes(userId) || group.joinRequests.includes(userId)) return;

        group.joinRequests.push(userId);
        StorageService._save(K_GROUPS, groups);
        // The admin is on another device; the group sheet is the only shared channel.
        if (group.storageType === 'SHEET') await StorageService.syncToSheet(group);
    },

    inviteMember: async (groupId: string, userId: string): Promise<void> => {
        const groups = StorageService.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (!group || group.members.includes(userId) || group.pendingMembers.includes(userId)) return;

        group.pendingMembers.push(userId);
        StorageService._save(K_GROUPS, groups);

        if (group.storageType !== 'SHEET' || !group.connectionString) {
            // A LOCAL group lives only in this browser, so there is nothing the
            // invitee's device could read. The caller surfaces this to the user.
            return;
        }

        await StorageService.syncToSheet(group);

        // The invitee's device discovers groups only through the group links on their
        // own row in the global auth sheet. Without this the invite is written to the
        // group sheet and never seen by anyone but the inviter.
        await StorageService.addUserGroupToGlobalSheet(userId, group.id, group.connectionString);
    },

    acceptInvite: async (groupId: string, userId: string): Promise<void> => {
        const groups = StorageService.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (!group) return;

        group.pendingMembers = group.pendingMembers.filter(id => id !== userId);
        if (!group.members.includes(userId)) {
            group.members.push(userId);
        }
        StorageService._save(K_GROUPS, groups);
        if (group.storageType === 'SHEET') await StorageService.syncToSheet(group);

        // Sync to global
        await StorageService.addUserGroupToGlobalSheet(userId, group.id, group.storageType === 'SHEET' ? group.connectionString : undefined);
    },

    declineInvite: async (groupId: string, userId: string): Promise<void> => {
        const groups = StorageService.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (!group) return;

        group.pendingMembers = group.pendingMembers.filter(id => id !== userId);
        StorageService._save(K_GROUPS, groups);
        // Push the removal out, otherwise the next sync re-adds the invite.
        if (group.storageType === 'SHEET') await StorageService.syncToSheet(group);
    },

    approveJoinRequest: async (groupId: string, userId: string): Promise<void> => {
        const groups = StorageService.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (!group) return;

        group.joinRequests = group.joinRequests.filter(id => id !== userId);
        if (!group.members.includes(userId)) {
            group.members.push(userId);
        }
        StorageService._save(K_GROUPS, groups);
        if (group.storageType === 'SHEET') await StorageService.syncToSheet(group);

        // Sync to global
        await StorageService.addUserGroupToGlobalSheet(userId, group.id, group.storageType === 'SHEET' ? group.connectionString : undefined);
    },

    rejectJoinRequest: async (groupId: string, userId: string): Promise<void> => {
        const groups = StorageService.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (!group) return;

        group.joinRequests = group.joinRequests.filter(id => id !== userId);
        StorageService._save(K_GROUPS, groups);
        if (group.storageType === 'SHEET') await StorageService.syncToSheet(group);
    },

    // --- Expenses ---
    getExpenses: (): Expense[] => StorageService._get<Expense>(K_EXPENSES),

    addExpense: (groupId: string, description: string, amount: number, paidBy: string, splits: { userId: string, amount: number }[], splitType: 'EQUAL' | 'EXACT' | 'PERCENTAGE' = 'EQUAL'): Expense => {
        const expenses = StorageService.getExpenses();
        const newExpense: Expense = {
            id: crypto.randomUUID(),
            groupId,
            description,
            amount,
            paidBy,
            splits,
            splitType,
            createdAt: Date.now(),
        };
        expenses.push(newExpense);
        StorageService._save(K_EXPENSES, expenses);

        // Sync trigger
        const groups = StorageService.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (group && group.storageType === 'SHEET') {
            StorageService.syncToSheet(group);
        }

        return newExpense;
    },

    updateExpense: (updated: Expense) => {
        const expenses = StorageService.getExpenses();
        const index = expenses.findIndex(e => e.id === updated.id);
        if (index !== -1) {
            expenses[index] = updated;
            StorageService._save(K_EXPENSES, expenses);

            // Sync trigger
            const groups = StorageService.getGroups();
            const group = groups.find(g => g.id === updated.groupId);
            if (group && group.storageType === 'SHEET') {
                StorageService.syncToSheet(group);
            }
        }
    },

    deleteExpense: (expenseId: string) => {
        let expenses = StorageService.getExpenses();
        const target = expenses.find(e => e.id === expenseId);
        expenses = expenses.filter(e => e.id !== expenseId);
        StorageService._save(K_EXPENSES, expenses);

        if (target) {
            const groups = StorageService.getGroups();
            const group = groups.find(g => g.id === target.groupId);
            if (group && group.storageType === 'SHEET') {
                StorageService.syncToSheet(group);
            }
        }
    },

    getGroupExpenses: (groupId: string): Expense[] => {
        const expenses = StorageService.getExpenses();
        return expenses.filter(e => e.groupId === groupId).sort((a, b) => b.createdAt - a.createdAt);
    },

    addUserGroupToGlobalSheet: async (userId: string, groupId: string, groupLink?: string) => {
        const sheetUrl = process.env.NEXT_PUBLIC_AUTH_SHEET_URL;
        if (!sheetUrl) return;

        try {
            await fetch(sheetUrl, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: "ADD_USER_GROUP",
                    payload: { userId, groupId, groupLink }
                })
            });
        } catch (e) {
            console.error("Failed to sync user group to global sheet", e);
        }
    },

    /**
     * Pulls the group links recorded against this account on the global auth sheet and
     * materialises any group this device has never seen. This is what makes an account
     * usable from a second device (or a phone browser) at all.
     */
    fetchUserGroups: async (userId: string): Promise<void> => {
        const sheetUrl = process.env.NEXT_PUBLIC_AUTH_SHEET_URL;
        if (!sheetUrl) return;

        let data: any;
        try {
            const res = await fetch(`${sheetUrl}?action=GET_USER_GROUPS&userId=${encodeURIComponent(userId)}`);
            data = await res.json();
        } catch (e) {
            console.error("Failed to fetch user groups", e);
            return;
        }

        if (data.status !== "success" || !data.groupLinks) return;

        const links: Record<string, string> = data.groupLinks;
        const localGroups = StorageService.getGroups();
        const toSync: Group[] = [];

        for (const [gId, link] of Object.entries(links)) {
            if (typeof link !== "string" || !link) continue;

            const existing = localGroups.find(g => g.id === gId);
            if (existing) {
                // Keep the link current, then refresh from the group's own sheet.
                existing.storageType = "SHEET";
                existing.connectionString = link;
                toSync.push(existing);
                continue;
            }

            // A placeholder until the group's own sheet fills it in. members[] stays
            // empty on purpose: membership is decided by the group sheet, and seeding
            // it with this user would show a group they have only been invited to.
            const stub: Group = {
                id: gId,
                name: "Loading...",
                members: [],
                pendingMembers: [],
                joinRequests: [],
                createdBy: "",
                createdAt: Date.now(),
                storageType: "SHEET",
                connectionString: link
            };
            localGroups.push(stub);
            toSync.push(stub);
        }

        // Persist before syncing: syncFromSheet re-reads groups from localStorage and
        // silently does nothing when the group isn't there yet.
        StorageService._save(K_GROUPS, localGroups);

        await Promise.all(toSync.map(g => StorageService.syncFromSheet(g)));
    },

    /**
     * Refreshes everything this user can see: their group list from the auth sheet,
     * then each sheet-backed group. Safe to call on every dashboard mount.
     */
    syncAll: async (userId: string): Promise<void> => {
        await StorageService.fetchUserGroups(userId);

        const relevant = StorageService.getGroups().filter(
            g => g.storageType === "SHEET" &&
                g.connectionString &&
                (g.members.includes(userId) || g.pendingMembers?.includes(userId) || g.joinRequests?.includes(userId))
        );

        await Promise.all(relevant.map(g => StorageService.syncFromSheet(g)));
    }
};
