"use client";

import { User, Group, Expense, ExpenseSplit, SplitType } from "../types";

// Keys for LocalStorage. Local storage is a cache and an offline buffer only -
// the Apps Script sheet is the source of truth, which is what lets the same
// account see its groups from a laptop and a phone.
const K_USERS = "splitplus_users";
const K_GROUPS = "splitplus_groups";
const K_EXPENSES = "splitplus_expenses";
const K_CURRENT_USER = "splitplus_current_user_id";
const K_MIGRATED = "splitplus_migrated_groups";

const SHEET_URL = process.env.NEXT_PUBLIC_AUTH_SHEET_URL;

// Shown when the request never reaches the Apps Script (blocked, offline, or a
// non-CORS error page), which the browser reports only as a generic failure.
const UNREACHABLE_SHEET_MSG =
    "Couldn't reach the Splitplus sheet. Re-deploy the Apps Script web app with " +
    "\"Execute as: Me\" and \"Who has access: Anyone\", then update NEXT_PUBLIC_AUTH_SHEET_URL.";

interface SheetResponse {
    status: string;
    message?: string;
    [key: string]: unknown;
}

export const StorageService = {
    // --- Transport ---

    /** True when a backend is configured. Without one the app is single-device. */
    isSynced: (): boolean => Boolean(SHEET_URL),

    /**
     * text/plain keeps this a "simple" request, so the browser skips the CORS
     * preflight that Apps Script cannot answer.
     */
    _post: async (action: string, payload: unknown): Promise<SheetResponse | null> => {
        if (!SHEET_URL) return null;
        try {
            const res = await fetch(SHEET_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action, payload })
            });
            return await res.json();
        } catch (e) {
            console.error(`Sheet request failed: ${action}`, e);
            return null;
        }
    },

    _fetch: async (params: Record<string, string>): Promise<SheetResponse | null> => {
        if (!SHEET_URL) return null;
        try {
            const qs = new URLSearchParams(params).toString();
            const res = await fetch(`${SHEET_URL}?${qs}`);
            return await res.json();
        } catch (e) {
            console.error("Sheet request failed", params, e);
            return null;
        }
    },

    // --- Local cache helpers ---

    _get: <T>(key: string): T[] => {
        if (typeof window === "undefined") return [];
        const data = localStorage.getItem(key);
        if (!data) return [];
        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    },

    _save: (key: string, data: unknown[]) => {
        if (typeof window === "undefined") return;
        localStorage.setItem(key, JSON.stringify(data));
    },

    hashPassword: async (password: string): Promise<string> => {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    },

    // --- Users ---

    getUsers: (): User[] => StorageService._get<User>(K_USERS),

    findUserByUsername: (username: string): User | undefined => {
        const users = StorageService.getUsers();
        return users.find(u => u.username.toLowerCase() === username.toLowerCase());
    },

    /**
     * Resolves a username to an account, consulting the sheet when the local cache
     * misses. Inviting someone who signed up on their own device is the normal
     * case, so a local-only lookup would fail for almost every invite.
     */
    findUserByUsernameRemote: async (username: string): Promise<User | undefined> => {
        const local = StorageService.findUserByUsername(username);
        if (local) return local;

        const data = await StorageService._post("FIND_USER", { username });
        if (!data || data.status !== "success" || !data.user) return undefined;

        const found = data.user as { id: string; username: string };
        const stub: User = { id: found.id, username: found.username, password: "", createdAt: Date.now() };
        StorageService._cacheUsers([stub]);
        return stub;
    },

    /**
     * Merges user records into the local cache without clobbering real credentials
     * with the blank password a stub carries.
     */
    _cacheUsers: (incoming: { id: string; username: string }[]) => {
        if (incoming.length === 0) return;
        const users = StorageService._get<User>(K_USERS);
        let changed = false;

        incoming.forEach(u => {
            if (!u.id) return;
            const idx = users.findIndex(existing => existing.id === u.id);
            if (idx === -1) {
                users.push({ id: u.id, username: u.username, password: "", createdAt: Date.now() });
                changed = true;
            } else if (u.username && users[idx].username !== u.username) {
                users[idx] = { ...users[idx], username: u.username };
                changed = true;
            }
        });

        if (changed) StorageService._save(K_USERS, users);
    },

    createUser: async (username: string, password: string): Promise<User> => {
        const hashedPassword = await StorageService.hashPassword(password);

        if (!SHEET_URL) {
            // Local-only fallback: no backend configured.
            const users = StorageService.getUsers();
            if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
                throw new Error("Username already taken");
            }

            const newUser: User = { id: crypto.randomUUID(), username, password: hashedPassword, createdAt: Date.now() };
            users.push(newUser);
            StorageService._save(K_USERS, users);
            localStorage.setItem(K_CURRENT_USER, newUser.id);
            return newUser;
        }

        const data = await StorageService._post("SIGNUP", {
            id: crypto.randomUUID(),
            username,
            password: hashedPassword
        });

        if (!data) throw new Error(UNREACHABLE_SHEET_MSG);
        if (data.status !== "success" || !data.user) throw new Error(data.message || "Signup failed");

        const remote = data.user as { id: string; username: string };
        const user: User = {
            id: remote.id,
            username: remote.username,
            // Cache the hash (never the plaintext) so login works offline too.
            password: hashedPassword,
            createdAt: Date.now()
        };

        StorageService._upsertLocalUser(user);
        localStorage.setItem(K_CURRENT_USER, user.id);
        return user;
    },

    _upsertLocalUser: (user: User) => {
        const users = StorageService._get<User>(K_USERS);
        const idx = users.findIndex(u => u.id === user.id);
        if (idx === -1) users.push(user);
        else users[idx] = { ...users[idx], ...user };
        StorageService._save(K_USERS, users);
    },

    login: async (username: string, password: string): Promise<User> => {
        const hashedPassword = await StorageService.hashPassword(password);

        // The sheet is the source of truth when configured: it is the only store that
        // knows about accounts created in another browser or on another device.
        if (SHEET_URL) {
            const data = await StorageService._post("LOGIN", { username, password: hashedPassword });

            if (data) {
                if (data.status !== "success" || !data.user) {
                    throw new Error(data.message || "Invalid credentials");
                }

                const remote = data.user as { id: string; username: string };
                const user: User = { id: remote.id, username: remote.username, password: hashedPassword, createdAt: Date.now() };

                StorageService._upsertLocalUser(user);
                localStorage.setItem(K_CURRENT_USER, user.id);

                // Awaited: a fresh device has no groups cached, so returning before the
                // pull lands renders an empty dashboard.
                await StorageService.syncAll(user.id);

                return user;
            }
            // Fall through to local verification so a network blip doesn't lock out
            // an account this browser already knows about.
        }

        const user = StorageService.findUserByUsername(username);
        if (!user || (user.password !== hashedPassword && user.password !== password)) {
            throw new Error(SHEET_URL ? UNREACHABLE_SHEET_MSG : "Invalid credentials");
        }

        if (user.password === password) {
            // Legacy migration: plaintext on record, replace it with the hash.
            StorageService._upsertLocalUser({ ...user, password: hashedPassword });
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
        return StorageService.getUsers().find(u => u.id === id) || null;
    },

    /**
     * Permanently deletes an account and frees its username. Requires the account's
     * own password as confirmation. Expenses are deliberately left intact so other
     * members' balances do not shift; the departed user stops resolving to a name.
     */
    deleteAccount: async (username: string, password: string): Promise<void> => {
        const hashedPassword = await StorageService.hashPassword(password);
        let deletedId: string;

        if (SHEET_URL) {
            const data = await StorageService._post("DELETE_ACCOUNT", { username, password: hashedPassword });

            // Deliberately no local-only fallback: the sheet row would survive, keeping
            // the username taken everywhere while the account vanished from this device.
            if (!data) throw new Error(UNREACHABLE_SHEET_MSG);
            if (data.status !== "success" || !data.user) throw new Error(data.message || "Invalid credentials");

            deletedId = (data.user as { id: string }).id;
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
        const remaining = StorageService.getUsers().filter(u => u.id !== userId);
        StorageService._save(K_USERS, remaining);

        // Group membership was already rewritten server-side; drop the local copies
        // so a stale cache can't push the deleted user back.
        const groups = StorageService.getGroups().filter(g => !g.members.includes(userId));
        StorageService._save(K_GROUPS, groups);

        if (localStorage.getItem(K_CURRENT_USER) === userId) {
            localStorage.removeItem(K_CURRENT_USER);
        }
    },

    // --- Groups ---

    getGroups: (): Group[] => {
        const groups = StorageService._get<Group>(K_GROUPS);
        // Migration for legacy groups, including ones created before the per-group
        // sheet was removed.
        return groups.map(g => ({
            id: g.id,
            name: g.name,
            members: g.members || [],
            pendingMembers: g.pendingMembers || [],
            joinRequests: g.joinRequests || [],
            image: g.image,
            createdBy: g.createdBy || (g.members?.[0] || ""),
            createdAt: g.createdAt || Date.now()
        }));
    },

    getUserGroups: (userId: string): Group[] =>
        StorageService.getGroups().filter(g => g.members.includes(userId)),

    getPendingInvites: (userId: string): Group[] =>
        StorageService.getGroups().filter(g => g.pendingMembers?.includes(userId)),

    getGroup: (groupId: string): Group | undefined =>
        StorageService.getGroups().find(g => g.id === groupId),

    _saveGroupLocal: (group: Group) => {
        const groups = StorageService.getGroups();
        const idx = groups.findIndex(g => g.id === group.id);
        if (idx === -1) groups.push(group);
        else groups[idx] = group;
        StorageService._save(K_GROUPS, groups);
    },

    createGroup: async (name: string, memberIds: string[], creatorId: string): Promise<Group> => {
        const newGroup: Group = {
            id: crypto.randomUUID(),
            name,
            members: [creatorId], // Only the creator is active initially
            pendingMembers: memberIds.filter(id => id !== creatorId), // Others are invited
            joinRequests: [],
            createdBy: creatorId,
            createdAt: Date.now()
        };

        StorageService._saveGroupLocal(newGroup);
        StorageService._markMigrated(newGroup.id);
        await StorageService._post("SAVE_GROUP", newGroup);

        return newGroup;
    },

    deleteGroup: async (groupId: string): Promise<void> => {
        StorageService._save(K_GROUPS, StorageService.getGroups().filter(g => g.id !== groupId));
        StorageService._save(K_EXPENSES, StorageService.getExpenses().filter(e => e.groupId !== groupId));
        await StorageService._post("DELETE_GROUP", { groupId });
    },

    /**
     * Applies a membership change on the server and adopts the group it returns.
     * The server owns these edits so two people acting at once cannot overwrite
     * each other with their own stale copy of the member lists.
     */
    _membership: async (groupId: string, userId: string, op: string): Promise<boolean> => {
        const data = await StorageService._post("MEMBERSHIP", { groupId, userId, op });

        if (data && data.status === "success" && data.group) {
            StorageService._saveGroupLocal(data.group as Group);
            return true;
        }

        if (SHEET_URL) return false;

        // No backend configured: apply locally so single-device use still works.
        const group = StorageService.getGroup(groupId);
        if (!group) return false;

        const drop = (list: string[]) => list.filter(id => id !== userId);
        const add = (list: string[]) => (list.includes(userId) ? list : [...list, userId]);

        if (op === "invite") group.pendingMembers = add(group.pendingMembers);
        else if (op === "request") group.joinRequests = add(group.joinRequests);
        else if (op === "accept" || op === "approve") {
            group.members = add(group.members);
            group.pendingMembers = drop(group.pendingMembers);
            group.joinRequests = drop(group.joinRequests);
        } else if (op === "decline" || op === "reject") {
            group.pendingMembers = drop(group.pendingMembers);
            group.joinRequests = drop(group.joinRequests);
        } else if (op === "leave") {
            group.members = drop(group.members);
        }

        StorageService._saveGroupLocal(group);
        return true;
    },

    inviteMember: (groupId: string, userId: string) => StorageService._membership(groupId, userId, "invite"),
    acceptInvite: (groupId: string, userId: string) => StorageService._membership(groupId, userId, "accept"),
    declineInvite: (groupId: string, userId: string) => StorageService._membership(groupId, userId, "decline"),
    approveJoinRequest: (groupId: string, userId: string) => StorageService._membership(groupId, userId, "approve"),
    rejectJoinRequest: (groupId: string, userId: string) => StorageService._membership(groupId, userId, "reject"),
    leaveGroup: (groupId: string, userId: string) => StorageService._membership(groupId, userId, "leave"),

    /**
     * Joining by ID has to work for a group this device has never seen, so the group
     * is fetched by id rather than looked up in the local cache.
     */
    requestJoin: async (groupId: string, userId: string): Promise<{ ok: boolean; message: string }> => {
        let group = StorageService.getGroup(groupId);

        if (!group) {
            const data = await StorageService._fetch({ action: "GET_GROUP", groupId });
            if (!data) return { ok: false, message: UNREACHABLE_SHEET_MSG };
            if (data.status !== "success" || !data.group) return { ok: false, message: "Group not found." };

            group = data.group as Group;
            StorageService._saveGroupLocal(group);
        }

        if (group.members.includes(userId)) return { ok: false, message: "You are already in this group." };
        if (group.joinRequests?.includes(userId)) return { ok: false, message: "Request already sent." };

        const wasInvited = group.pendingMembers?.includes(userId);
        const ok = await StorageService._membership(group.id, userId, "request");
        if (!ok) return { ok: false, message: UNREACHABLE_SHEET_MSG };

        // The server turns a request into a join when an invite was already waiting.
        return { ok: true, message: wasInvited ? "You had an invite - you're in!" : "Request sent to the group admin." };
    },

    // --- Expenses ---

    getExpenses: (): Expense[] => StorageService._get<Expense>(K_EXPENSES),

    getGroupExpenses: (groupId: string): Expense[] =>
        StorageService.getExpenses()
            .filter(e => e.groupId === groupId)
            .sort((a, b) => b.createdAt - a.createdAt),

    addExpense: async (
        groupId: string,
        description: string,
        amount: number,
        paidBy: string,
        splits: ExpenseSplit[],
        splitType: SplitType = "EQUAL"
    ): Promise<Expense> => {
        const newExpense: Expense = {
            id: crypto.randomUUID(),
            groupId,
            description,
            amount,
            paidBy,
            splits,
            splitType,
            createdAt: Date.now()
        };

        const expenses = StorageService.getExpenses();
        expenses.push(newExpense);
        StorageService._save(K_EXPENSES, expenses);

        await StorageService._post("SAVE_EXPENSE", newExpense);
        return newExpense;
    },

    updateExpense: async (updated: Expense): Promise<void> => {
        const expenses = StorageService.getExpenses();
        const index = expenses.findIndex(e => e.id === updated.id);
        if (index === -1) return;

        expenses[index] = updated;
        StorageService._save(K_EXPENSES, expenses);

        await StorageService._post("SAVE_EXPENSE", updated);
    },

    /**
     * Marks one person's share of one expense as squared up (or puts it back).
     *
     * Stored on the split itself rather than as a separate settlement record, so it
     * travels with the expense through the sheet without a schema change - the
     * script stores splits as opaque JSON.
     */
    setShareSettled: async (expenseId: string, userId: string, settled: boolean): Promise<boolean> => {
        const expenses = StorageService.getExpenses();
        const index = expenses.findIndex(e => e.id === expenseId);
        if (index === -1) return false;

        const expense = expenses[index];
        const target = expense.splits?.find(sp => sp.userId === userId);
        if (!target) return false;
        if (Boolean(target.settled) === settled) return true; // Already there.

        const updated: Expense = {
            ...expense,
            splits: expense.splits.map(sp =>
                sp.userId === userId
                    ? { ...sp, settled, settledAt: settled ? Date.now() : undefined }
                    : sp
            )
        };

        expenses[index] = updated;
        StorageService._save(K_EXPENSES, expenses);

        const res = await StorageService._post("SAVE_EXPENSE", updated);
        return !SHEET_URL || res?.status === "success";
    },

    deleteExpense: async (expenseId: string): Promise<void> => {
        StorageService._save(K_EXPENSES, StorageService.getExpenses().filter(e => e.id !== expenseId));
        await StorageService._post("DELETE_EXPENSE", { expenseId });
    },

    // --- Sync ---

    _markMigrated: (groupId: string) => {
        const done = StorageService._get<string>(K_MIGRATED);
        if (!done.includes(groupId)) StorageService._save(K_MIGRATED, [...done, groupId]);
    },

    /**
     * Pulls everything this account can see in one round trip and replaces the local
     * cache with it. This is what populates a device that has only just logged in,
     * and what makes an invite sent from someone else's phone show up here.
     */
    syncAll: async (userId: string): Promise<boolean> => {
        const data = await StorageService._fetch({ action: "GET_USER_DATA", userId });
        if (!data || data.status !== "success") return false;

        const remoteGroups = (data.groups || []) as Group[];
        const remoteExpenses = (data.expenses || []) as Expense[];
        StorageService._cacheUsers((data.users || []) as { id: string; username: string }[]);

        const remoteIds = new Set(remoteGroups.map(g => g.id));

        // Keep local groups the server doesn't know about only while they are still
        // pending upload; anything already synced and now absent was deleted or left,
        // so dropping it is correct.
        const migrated = new Set(StorageService._get<string>(K_MIGRATED));
        const local = StorageService.getGroups();
        const unsynced = local.filter(g => !remoteIds.has(g.id) && !migrated.has(g.id));

        StorageService._save(K_GROUPS, [...remoteGroups, ...unsynced]);

        // Expenses of groups we still hold locally survive; the rest are replaced.
        const keptLocalIds = new Set(unsynced.map(g => g.id));
        const localExpenses = StorageService.getExpenses().filter(e => keptLocalIds.has(e.groupId));
        StorageService._save(K_EXPENSES, [...remoteExpenses, ...localExpenses]);

        // One-time upload of groups made before this device had a backend, so nothing
        // created offline is stranded.
        await Promise.all(unsynced.map(async g => {
            if (!g.members.includes(userId)) return;
            await StorageService._post("SAVE_GROUP", g);
            await Promise.all(
                StorageService.getGroupExpenses(g.id).map(e => StorageService._post("SAVE_EXPENSE", e))
            );
            StorageService._markMigrated(g.id);
        }));

        return true;
    }
};
