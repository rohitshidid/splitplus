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
    getGroups: (): Group[] => StorageService._get<Group>(K_GROUPS),

    createGroup: (name: string, memberIds: string[], currentUserId: string): Group => {
        const groups = StorageService.getGroups();
        const newGroup: Group = {
            id: crypto.randomUUID(),
            name,
            members: [...new Set([...memberIds, currentUserId])], // Ensure creator is included
            createdBy: currentUserId,
            createdAt: Date.now(),
        };
        groups.push(newGroup);
        StorageService._save(K_GROUPS, groups);
        return newGroup;
    },

    getUserGroups: (userId: string): Group[] => {
        const groups = StorageService.getGroups();
        return groups.filter(g => g.members.includes(userId));
    },

    deleteGroup: (groupId: string) => {
        // Remove Group
        let groups = StorageService.getGroups();
        groups = groups.filter(g => g.id !== groupId);
        StorageService._save(K_GROUPS, groups);

        // Remove associated Expenses
        let expenses = StorageService.getExpenses();
        expenses = expenses.filter(e => e.groupId !== groupId);
        StorageService._save(K_EXPENSES, expenses);
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
        return newExpense;
    },

    updateExpense: (updated: Expense) => {
        const expenses = StorageService.getExpenses();
        const index = expenses.findIndex(e => e.id === updated.id);
        if (index !== -1) {
            expenses[index] = updated;
            StorageService._save(K_EXPENSES, expenses);
        }
    },

    deleteExpense: (expenseId: string) => {
        let expenses = StorageService.getExpenses();
        expenses = expenses.filter(e => e.id !== expenseId);
        StorageService._save(K_EXPENSES, expenses);
    },

    getGroupExpenses: (groupId: string): Expense[] => {
        const expenses = StorageService.getExpenses();
        return expenses.filter(e => e.groupId === groupId).sort((a, b) => b.createdAt - a.createdAt);
    }
};
