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

    createUser: (username: string, password: string): User => {
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
    },

    login: (username: string, password: string): User => {
        const user = StorageService.findUserByUsername(username);
        if (!user || user.password !== password) {
            throw new Error("Invalid credentials");
        }
        localStorage.setItem(K_CURRENT_USER, user.id);
        return user;
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

    // --- Google Sheets Sync ---

    syncToSheet: async (group: Group) => {
        if (group.storageType !== 'SHEET' || !group.connectionString) return;

        const payload = {
            meta: { id: group.id, name: group.name, createdBy: group.createdBy },
            members: StorageService.getUsers().filter(u => group.members.includes(u.id)),
            expenses: StorageService.getGroupExpenses(group.id)
        };

        try {
            await fetch(group.connectionString, {
                method: "POST",
                mode: "no-cors", // GAS POST often requires no-cors if not expecting standard JSON response structure usable by browser directly due to CORS
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "SYNC_GROUP", payload })
            });
            // Note: no-cors means we can't read response, but GAS will receive it.
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
                // Merge Logic? For now, Sheet is Truth.
                // 1. Update Group Members if changed? 
                // (Actually, app is source of truth for IDs, Sheet is just storage. 
                // But if other users update sheet, we need to reflect that).

                // For MVP: We just update Expenses from Sheet.
                // Re-hydrate expenses
                const remoteExpenses = data.data.expenses;
                // Filter out current group expenses and replace
                let allExpenses = StorageService.getExpenses();
                allExpenses = allExpenses.filter(e => e.groupId !== group.id);

                // Add remote
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
