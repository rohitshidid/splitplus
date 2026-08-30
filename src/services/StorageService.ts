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
                StorageService.fetchUserGroups(user.id);

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
        StorageService.fetchUserGroups(user.id);

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

        // If Sheet, initial sync (fire and forget for now, or could await)
        if (storageType === 'SHEET' && connectionString) {
            StorageService.syncToSheet(newGroup);
        }

        // Sync to Global Auth Sheet (Add User Group)
        StorageService.addUserGroupToGlobalSheet(creatorId, newGroup.id, storageType === 'SHEET' ? connectionString : undefined);

        return newGroup;
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

        // Prepare comprehensive member list with status
        const allUsers = StorageService.getUsers(); // This gets local users.
        // Note: If using Global Auth, we might need names from IDs that aren't local.
        // For now, assume users we deal with have local presence or minimal info.

        const membersPayload = [
            ...group.members.map(id => ({ id, username: allUsers.find(u => u.id === id)?.username || "User", status: "active" })),
            ...(group.pendingMembers || []).map(id => ({ id, username: allUsers.find(u => u.id === id)?.username || "User", status: "pending" })),
            ...(group.joinRequests || []).map(id => ({ id, username: allUsers.find(u => u.id === id)?.username || "User", status: "requested" }))
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

        try {
            const res = await fetch(`${group.connectionString}?action=GET_ALL`);
            const data = await res.json();

            if (data.status === "success" && data.data) {
                // 1. Sync Members & Status
                // We need to map the sheet's "members + status" back to the group object
                const sheetMembers = data.data.members || [];
                const active: string[] = [];
                const pending: string[] = [];
                const requests: string[] = [];

                sheetMembers.forEach((row: any) => {
                    if (row.status === "active") active.push(row.id);
                    else if (row.status === "pending") pending.push(row.id);
                    else if (row.status === "requested") requests.push(row.id);

                    // Side effect: Ensure we have this user in our local "cache" so names show up?
                    // If we don't have them, we might create a stub user.
                    let localUsers = StorageService._get<User>(K_USERS);
                    if (!localUsers.find(u => u.id === row.id)) {
                        localUsers.push({ id: row.id, username: row.username, password: "", createdAt: Date.now() });
                        StorageService._save(K_USERS, localUsers);
                    }
                });

                // Update Group
                let groups = StorageService.getGroups();
                const groupIndex = groups.findIndex(g => g.id === group.id);
                if (groupIndex !== -1) {
                    groups[groupIndex].members = active;
                    groups[groupIndex].pendingMembers = pending;
                    groups[groupIndex].joinRequests = requests;
                    // Sync meta?
                    if (data.data.meta && data.data.meta.name) groups[groupIndex].name = data.data.meta.name;

                    StorageService._save(K_GROUPS, groups);
                }

                // 2. Sync Expenses
                const remoteExpenses = data.data.expenses;
                let allExpenses = StorageService.getExpenses();
                allExpenses = allExpenses.filter(e => e.groupId !== group.id);
                allExpenses.push(...remoteExpenses);
                StorageService._save(K_EXPENSES, allExpenses);
            }
        } catch (err) {
            console.error("Failed to sync from sheet", err);
        }
    },

    // --- Approvals & Invites ---

    requestJoin: (groupId: string, userId: string) => {
        const groups = StorageService.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (group && !group.members.includes(userId) && !group.joinRequests.includes(userId)) {
            group.joinRequests.push(userId);
            StorageService._save(K_GROUPS, groups);
        }
    },

    inviteMember: (groupId: string, userId: string) => {
        const groups = StorageService.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (group && !group.members.includes(userId) && !group.pendingMembers.includes(userId)) {
            group.pendingMembers.push(userId);
            StorageService._save(K_GROUPS, groups);

            if (group.storageType === 'SHEET') StorageService.syncToSheet(group);
        }
    },

    acceptInvite: (groupId: string, userId: string) => {
        const groups = StorageService.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (group) {
            group.pendingMembers = group.pendingMembers.filter(id => id !== userId);
            if (!group.members.includes(userId)) {
                group.members.push(userId);
            }
            StorageService._save(K_GROUPS, groups);
            if (group.storageType === 'SHEET') StorageService.syncToSheet(group);

            // Sync to global
            StorageService.addUserGroupToGlobalSheet(userId, group.id, group.storageType === 'SHEET' ? group.connectionString : undefined);
        }
    },

    declineInvite: (groupId: string, userId: string) => {
        const groups = StorageService.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (group) {
            group.pendingMembers = group.pendingMembers.filter(id => id !== userId);
            StorageService._save(K_GROUPS, groups);
        }
    },

    approveJoinRequest: (groupId: string, userId: string) => {
        const groups = StorageService.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (group) {
            group.joinRequests = group.joinRequests.filter(id => id !== userId);
            if (!group.members.includes(userId)) {
                group.members.push(userId);
            }
            StorageService._save(K_GROUPS, groups);
            if (group.storageType === 'SHEET') StorageService.syncToSheet(group);

            // Sync to global
            StorageService.addUserGroupToGlobalSheet(userId, group.id, group.storageType === 'SHEET' ? group.connectionString : undefined);
        }
    },

    rejectJoinRequest: (groupId: string, userId: string) => {
        const groups = StorageService.getGroups();
        const group = groups.find(g => g.id === groupId);
        if (group) {
            group.joinRequests = group.joinRequests.filter(id => id !== userId);
            StorageService._save(K_GROUPS, groups);
        }
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

    fetchUserGroups: async (userId: string) => {
        const sheetUrl = process.env.NEXT_PUBLIC_AUTH_SHEET_URL;
        if (!sheetUrl) return;

        try {
            const res = await fetch(`${sheetUrl}?action=GET_USER_GROUPS&userId=${userId}`);
            const data = await res.json();

            if (data.status === "success" && data.groupLinks) {
                const links = data.groupLinks; // Record<groupId, url>
                const localGroups = StorageService.getGroups();
                let paramsChanged = false;

                for (const [gId, link] of Object.entries(links)) {
                    // Check if we have it
                    if (!localGroups.find(g => g.id === gId) && typeof link === 'string') {
                        // Create stub
                        const stub: Group = {
                            id: gId,
                            name: "Loading...",
                            members: [userId],
                            pendingMembers: [],
                            joinRequests: [],
                            createdBy: "",
                            createdAt: Date.now(),
                            storageType: 'SHEET',
                            connectionString: link
                        };
                        localGroups.push(stub);
                        paramsChanged = true;

                        // Trigger sync
                        StorageService.syncFromSheet(stub);
                    }
                }

                if (paramsChanged) {
                    StorageService._save(K_GROUPS, localGroups);
                }
            }
        } catch (e) {
            console.error("Failed to fetch user groups", e);
        }
    }
};
