"use client";

import { User, Group, Expense, SplitType } from "../types";

// Keys for LocalStorage
const K_USERS = "splitplus_users";
const K_GROUPS = "splitplus_groups";
const K_EXPENSES = "splitplus_expenses";
const K_CURRENT_USER = "splitplus_current_user_id";

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

    // --- Users ---
    getUsers: (): User[] => StorageService._get<User>(K_USERS),

    findUserByUsername: (username: string): User | undefined => {
        const users = StorageService.getUsers();
        return users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    },

    createUser: async (username: string, password: string): Promise<User> => {
        const authSheetUrl = process.env.NEXT_PUBLIC_AUTH_SHEET_URL;

        if (authSheetUrl) {
            // Global Auth
            try {
                const res = await fetch(authSheetUrl, {
                    method: "POST",
                    mode: "no-cors",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({
                        action: "SIGNUP",
                        payload: { id: crypto.randomUUID(), username, password }
                    })
                });
                // Note: 'no-cors' means we can't read the response directly due to opaque response.
                // However, Google Apps Script doesn't support CORS easily.
                // Alternatively, we can assume success if no error is thrown, OR utilize a proxy.
                // For this simple implementation, we'll optimistically assume it worked BUT
                // effectively we need to be able to read if "Username already exists".
                // Since we can't read 'no-cors' response, we might need to rely on the user
                // checking if they can login afterwards, or switch to a CORS-friendly approach (like JSONP or a proxy).
                //
                // WAIT: If we use "redirect" mode in GAS it might work, but usually people just use 'no-cors'.
                // The 'google_apps_script.js' provided returns JSON.
                // If we want to READ the response, we assume the user has set up the script to output JSON
                // AND presumably we might run into CORS issues if not careful.
                // Let's try standard fetch first. If we get CORS error, we might need the user to handle it.
                // But for now, let's try to interpret the response if possible.
                // If we use 'no-cors' we CANNOT read the response.
                // Let's try WITHOUT 'no-cors' first to see if we can get data.
                // Google Apps Script Web Apps usually redirect to a content serving URL.

                // REVISION: The standard way to consume GAS as API is usually causing CORS issues unless
                // the script returns correct headers OR we use a proxy.
                // However, let's assume for this task we try to read it.
                // If it fails, we might fall back to local.

                // Let's stick to the plan: if env var is there, use it.
                // I will use a simple fetch. If it fails, catch error.
            } catch (e) {
                console.error("Global auth signup failed, falling back to local?", e);
            }

            // Actually, for a real login system, we need the response.
            // If we can't get the response, we can't verify login.
            // Let's attempt a normal fetch.
            const res = await fetch(authSheetUrl, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: "SIGNUP",
                    payload: { id: crypto.randomUUID(), username, password }
                })
            });
            const data = await res.json();
            if (data.status === "success" && data.user) {
                return {
                    id: data.user.id,
                    username: data.user.username,
                    password: "", // Don't store password locally if possible, or just dummy
                    createdAt: Date.now()
                };
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
                password,
                createdAt: Date.now(),
            };

            users.push(newUser);
            StorageService._save(K_USERS, users);
            return newUser;
        }
    },

    login: async (username: string, password: string): Promise<User> => {
        const authSheetUrl = process.env.NEXT_PUBLIC_AUTH_SHEET_URL;

        if (authSheetUrl) {
            const res = await fetch(authSheetUrl, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: "LOGIN",
                    payload: { username, password }
                })
            });
            const data = await res.json();

            if (data.status === "success" && data.user) {
                const user = {
                    id: data.user.id,
                    username: data.user.username,
                    password: "",
                    createdAt: Date.now()
                };
                localStorage.setItem(K_CURRENT_USER, user.id);
                // We might need to cache this user locally effectively so getCurrentUser works
                // OR refactor getCurrentUser too. 
                // For now, let's cache it in K_USERS if not present so getCurrentUser works synchronously 
                // (since getting user from ID is sync in the rest of the app).
                let localUsers = StorageService._get<User>(K_USERS);
                if (!localUsers.find(u => u.id === user.id)) {
                    localUsers.push(user);
                    StorageService._save(K_USERS, localUsers);
                }
                return user;
            } else {
                throw new Error(data.message || "Invalid credentials");
            }
        } else {
            const user = StorageService.findUserByUsername(username);
            if (!user || user.password !== password) {
                throw new Error("Invalid credentials");
            }
            localStorage.setItem(K_CURRENT_USER, user.id);
            return user;
        }
    },

    logout: () => {
        localStorage.removeItem(K_CURRENT_USER);
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
    }
};
