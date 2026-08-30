export const GOOGLE_APPS_SCRIPT_SOURCE = `/**
 * Splitplus Database Script
 *
 * One spreadsheet backs the whole app: accounts, groups and expenses. Every
 * device talks to this single web app, which is what makes groups appear on
 * your phone after you created them on a laptop.
 *
 * Instructions:
 * 1. Create a new Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this code entirely (replace anything already there).
 * 4. Run the 'setup' function once to initialize the tabs.
 * 5. Deploy > New Deployment > Type: Web App.
 * 6. Configuration:
 *    - Description: Splitplus API
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 7. Copy the 'Web App URL' into NEXT_PUBLIC_AUTH_SHEET_URL.
 *
 * Re-deploying after an edit: use Deploy > Manage deployments > edit the
 * existing one and pick "New version", so the URL stays the same.
 */

var USER_HEADERS = ["id", "username", "password", "createdAt"];
var GROUP_HEADERS = ["id", "name", "members", "pendingMembers", "joinRequests", "createdBy", "createdAt", "updatedAt"];
var EXPENSE_HEADERS = ["id", "groupId", "description", "amount", "paidBy", "splits", "splitType", "createdAt"];

function setup() {
    ensureSheet("Users", USER_HEADERS);
    ensureSheet("Groups", GROUP_HEADERS);
    ensureSheet("Expenses", EXPENSE_HEADERS);
}

/** Creates the tab if missing, and appends any header column added by a later version. */
function ensureSheet(name, headers) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(name);

    if (!sheet) {
        sheet = ss.insertSheet(name);
        sheet.appendRow(headers);
        return sheet;
    }

    if (sheet.getLastRow() === 0) {
        sheet.appendRow(headers);
        return sheet;
    }

    const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    headers.forEach(h => {
        if (existing.indexOf(h) === -1) {
            sheet.getRange(1, existing.length + 1).setValue(h);
            existing.push(h);
        }
    });

    return sheet;
}

function doGet(e) {
    try {
        const action = e.parameter.action;

        if (action === "GET_USER_DATA") {
            return getUserData(e.parameter.userId);
        } else if (action === "GET_GROUP") {
            return getGroup(e.parameter.groupId);
        }

        return response({ status: "error", message: "Invalid action" });
    } catch (err) {
        return response({ status: "error", message: err.toString() });
    }
}

function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const action = data.action;

        if (action === "SIGNUP") {
            return registerUser(data.payload);
        } else if (action === "LOGIN") {
            return loginUser(data.payload);
        } else if (action === "FIND_USER") {
            return findUser(data.payload);
        } else if (action === "DELETE_ACCOUNT") {
            return deleteAccount(data.payload);
        } else if (action === "SAVE_GROUP") {
            return saveGroup(data.payload);
        } else if (action === "DELETE_GROUP") {
            return deleteGroup(data.payload);
        } else if (action === "MEMBERSHIP") {
            return membership(data.payload);
        } else if (action === "SAVE_EXPENSE") {
            return saveExpense(data.payload);
        } else if (action === "DELETE_EXPENSE") {
            return deleteExpense(data.payload);
        }

        return response({ status: "error", message: "Invalid action" });
    } catch (err) {
        return response({ status: "error", message: err.toString() });
    }
}

// --- Reads ---

/**
 * Everything one account can see, in a single round trip: the groups they are in
 * (or have been invited to), those groups' expenses, and the usernames needed to
 * label them. A device that has never seen this account rebuilds itself from this.
 */
function getUserData(userId) {
    if (!userId) return response({ status: "error", message: "Missing userId" });

    const groups = readAll("Groups").map(parseGroup).filter(g =>
        g.members.indexOf(userId) !== -1 ||
        g.pendingMembers.indexOf(userId) !== -1 ||
        g.joinRequests.indexOf(userId) !== -1
    );

    const groupIds = groups.map(g => g.id);
    const expenses = readAll("Expenses")
        .filter(e => groupIds.indexOf(String(e.groupId)) !== -1)
        .map(parseExpense);

    // Only the accounts actually referenced, and never their password hashes.
    const needed = {};
    groups.forEach(g => {
        g.members.concat(g.pendingMembers, g.joinRequests).forEach(id => { needed[id] = true; });
        needed[g.createdBy] = true;
    });
    expenses.forEach(e => { needed[e.paidBy] = true; });

    const users = readAll("Users")
        .filter(u => needed[String(u.id)])
        .map(u => ({ id: String(u.id), username: String(u.username) }));

    return response({ status: "success", groups: groups, expenses: expenses, users: users });
}

/** Used by "join by group ID" - the joiner is not a member yet, so getUserData can't reach it. */
function getGroup(groupId) {
    if (!groupId) return response({ status: "error", message: "Missing groupId" });

    const found = readAll("Groups").map(parseGroup).filter(g => g.id === String(groupId))[0];
    if (!found) return response({ status: "error", message: "Group not found" });

    return response({ status: "success", group: found });
}

// --- Groups ---

function saveGroup(group) {
    if (!group || !group.id) return response({ status: "error", message: "Missing group" });

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
        const sheet = ensureSheet("Groups", GROUP_HEADERS);
        const rowIndex = findRowIndex(sheet, "id", group.id);
        const values = groupToRow(sheet, group);

        if (rowIndex === -1) {
            sheet.appendRow(values);
        } else {
            sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
        }

        return response({ status: "success" });
    } finally {
        lock.releaseLock();
    }
}

function deleteGroup(payload) {
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
        const sheet = ensureSheet("Groups", GROUP_HEADERS);
        const rowIndex = findRowIndex(sheet, "id", payload.groupId);
        if (rowIndex !== -1) sheet.deleteRow(rowIndex);

        // Expenses would otherwise linger and be re-synced into a recreated group.
        const expSheet = ensureSheet("Expenses", EXPENSE_HEADERS);
        const rows = expSheet.getDataRange().getValues();
        const groupCol = rows[0].indexOf("groupId");
        if (groupCol !== -1) {
            for (let i = rows.length - 1; i >= 1; i--) {
                if (String(rows[i][groupCol]) === String(payload.groupId)) expSheet.deleteRow(i + 1);
            }
        }

        return response({ status: "success" });
    } finally {
        lock.releaseLock();
    }
}

/**
 * Membership changes are applied server-side rather than by writing the whole group
 * from the client: two people accepting invites at once would otherwise each
 * overwrite the other's change with their own stale copy of the member lists.
 */
function membership(payload) {
    const op = payload.op;
    const userId = String(payload.userId);

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
        const sheet = ensureSheet("Groups", GROUP_HEADERS);
        const rowIndex = findRowIndex(sheet, "id", payload.groupId);
        if (rowIndex === -1) return response({ status: "error", message: "Group not found" });

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const raw = {};
        const rowValues = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
        headers.forEach((h, i) => { raw[h] = rowValues[i]; });

        const group = parseGroup(raw);
        const drop = list => list.filter(id => id !== userId);
        const add = list => list.indexOf(userId) === -1 ? list.concat([userId]) : list;

        if (op === "invite") {
            if (group.members.indexOf(userId) !== -1) return response({ status: "error", message: "Already a member" });
            group.pendingMembers = add(group.pendingMembers);
            group.joinRequests = drop(group.joinRequests);
        } else if (op === "request") {
            if (group.members.indexOf(userId) !== -1) return response({ status: "error", message: "Already a member" });
            if (group.pendingMembers.indexOf(userId) !== -1) {
                // They were already invited; treat the request as accepting it.
                group.pendingMembers = drop(group.pendingMembers);
                group.members = add(group.members);
            } else {
                group.joinRequests = add(group.joinRequests);
            }
        } else if (op === "accept" || op === "approve") {
            group.members = add(group.members);
            group.pendingMembers = drop(group.pendingMembers);
            group.joinRequests = drop(group.joinRequests);
        } else if (op === "decline" || op === "reject") {
            group.pendingMembers = drop(group.pendingMembers);
            group.joinRequests = drop(group.joinRequests);
        } else if (op === "leave") {
            group.members = drop(group.members);
            group.pendingMembers = drop(group.pendingMembers);
            group.joinRequests = drop(group.joinRequests);
            // Hand the group to the longest-standing remaining member so the
            // approve/reject controls stay reachable.
            if (group.createdBy === userId && group.members.length > 0) group.createdBy = group.members[0];
        } else {
            return response({ status: "error", message: "Invalid membership op" });
        }

        const values = groupToRow(sheet, group);
        sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);

        return response({ status: "success", group: group });
    } finally {
        lock.releaseLock();
    }
}

// --- Expenses ---

function saveExpense(expense) {
    if (!expense || !expense.id) return response({ status: "error", message: "Missing expense" });

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
        const sheet = ensureSheet("Expenses", EXPENSE_HEADERS);
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const rowIndex = findRowIndex(sheet, "id", expense.id);

        const source = {
            id: expense.id,
            groupId: expense.groupId,
            description: expense.description,
            amount: expense.amount,
            paidBy: expense.paidBy,
            splits: JSON.stringify(expense.splits || []),
            splitType: expense.splitType || "EQUAL",
            createdAt: expense.createdAt
        };
        const values = headers.map(h => source[h] === undefined ? "" : source[h]);

        if (rowIndex === -1) {
            sheet.appendRow(values);
        } else {
            sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
        }

        return response({ status: "success" });
    } finally {
        lock.releaseLock();
    }
}

function deleteExpense(payload) {
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
        const sheet = ensureSheet("Expenses", EXPENSE_HEADERS);
        const rowIndex = findRowIndex(sheet, "id", payload.expenseId);
        if (rowIndex !== -1) sheet.deleteRow(rowIndex);
        return response({ status: "success" });
    } finally {
        lock.releaseLock();
    }
}

// --- Auth ---

function registerUser(user) {
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
        const sheet = ensureSheet("Users", USER_HEADERS);
        const users = readAll("Users");
        const wanted = String(user.username).toLowerCase();

        if (users.filter(u => String(u.username).toLowerCase() === wanted).length > 0) {
            return response({ status: "error", message: "Username already exists" });
        }

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const source = { id: user.id, username: user.username, password: user.password, createdAt: new Date().toISOString() };
        sheet.appendRow(headers.map(h => source[h] === undefined ? "" : source[h]));

        return response({ status: "success", user: { id: user.id, username: user.username } });
    } finally {
        lock.releaseLock();
    }
}

function loginUser(creds) {
    const users = readAll("Users");
    const wanted = String(creds.username).toLowerCase();
    const found = users.filter(u =>
        String(u.username).toLowerCase() === wanted && String(u.password) === String(creds.password)
    )[0];

    if (!found) return response({ status: "error", message: "Invalid credentials" });

    return response({ status: "success", user: { id: String(found.id), username: String(found.username) } });
}

/** Resolves a username to an id so one device can invite an account it has never seen. */
function findUser(payload) {
    const wanted = String(payload.username || "").trim().toLowerCase();
    if (!wanted) return response({ status: "error", message: "Missing username" });

    const found = readAll("Users").filter(u => String(u.username).toLowerCase() === wanted)[0];
    if (!found) return response({ status: "error", message: "User not found" });

    return response({ status: "success", user: { id: String(found.id), username: String(found.username) } });
}

function deleteAccount(creds) {
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
        const sheet = ensureSheet("Users", USER_HEADERS);
        const data = sheet.getDataRange().getValues();
        const idCol = data[0].indexOf("id");
        const userCol = data[0].indexOf("username");
        const passCol = data[0].indexOf("password");

        if (idCol === -1 || userCol === -1 || passCol === -1) {
            return response({ status: "error", message: "Schema mismatch (missing columns)" });
        }

        const wanted = String(creds.username).toLowerCase();
        for (let i = 1; i < data.length; i++) {
            if (String(data[i][userCol]).toLowerCase() !== wanted) continue;

            // Deletion is irreversible and frees the username for anyone to claim,
            // so an unauthenticated caller must never be able to delete someone else.
            if (String(data[i][passCol]) !== String(creds.password)) {
                return response({ status: "error", message: "Invalid credentials" });
            }

            const deletedId = String(data[i][idCol]);
            sheet.deleteRow(i + 1);
            removeUserFromGroups(deletedId);
            return response({ status: "success", user: { id: deletedId, username: creds.username } });
        }

        // Same message as a wrong password, so this cannot be used to probe which
        // usernames exist.
        return response({ status: "error", message: "Invalid credentials" });
    } finally {
        lock.releaseLock();
    }
}

/**
 * Drops a deleted account from every group. Expenses are deliberately left intact
 * so the other members' balances do not silently shift.
 */
function removeUserFromGroups(userId) {
    const sheet = ensureSheet("Groups", GROUP_HEADERS);
    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return;

    const headers = rows[0];
    for (let i = 1; i < rows.length; i++) {
        const raw = {};
        headers.forEach((h, j) => { raw[h] = rows[i][j]; });

        const group = parseGroup(raw);
        const before = group.members.length + group.pendingMembers.length + group.joinRequests.length;

        group.members = group.members.filter(id => id !== userId);
        group.pendingMembers = group.pendingMembers.filter(id => id !== userId);
        group.joinRequests = group.joinRequests.filter(id => id !== userId);

        const after = group.members.length + group.pendingMembers.length + group.joinRequests.length;
        if (before === after) continue;

        if (group.createdBy === userId && group.members.length > 0) group.createdBy = group.members[0];

        const values = groupToRow(sheet, group);
        sheet.getRange(i + 1, 1, 1, values.length).setValues([values]);
    }
}

// --- Helpers ---

function readAll(name) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    const out = [];

    for (let i = 1; i < rows.length; i++) {
        if (!rows[i][0]) continue; // Skip blank rows left behind by manual edits.
        const obj = {};
        for (let j = 0; j < headers.length; j++) obj[headers[j]] = rows[i][j];
        out.push(obj);
    }
    return out;
}

function findRowIndex(sheet, column, value) {
    if (sheet.getLastRow() < 2) return -1;
    const rows = sheet.getDataRange().getValues();
    const col = rows[0].indexOf(column);
    if (col === -1) return -1;

    for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][col]) === String(value)) return i + 1; // 1-based sheet row
    }
    return -1;
}

function parseList(value) {
    if (Array.isArray(value)) return value.map(String);
    try {
        const parsed = JSON.parse(value || "[]");
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (err) {
        return [];
    }
}

function parseGroup(raw) {
    return {
        id: String(raw.id),
        name: String(raw.name || ""),
        members: parseList(raw.members),
        pendingMembers: parseList(raw.pendingMembers),
        joinRequests: parseList(raw.joinRequests),
        createdBy: String(raw.createdBy || ""),
        createdAt: Number(raw.createdAt) || 0,
        updatedAt: Number(raw.updatedAt) || 0
    };
}

function groupToRow(sheet, group) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const source = {
        id: group.id,
        name: group.name,
        members: JSON.stringify(group.members || []),
        pendingMembers: JSON.stringify(group.pendingMembers || []),
        joinRequests: JSON.stringify(group.joinRequests || []),
        createdBy: group.createdBy,
        createdAt: group.createdAt,
        updatedAt: Date.now()
    };
    return headers.map(h => source[h] === undefined ? "" : source[h]);
}

function parseExpense(raw) {
    let splits = [];
    try { splits = JSON.parse(raw.splits || "[]"); } catch (err) { splits = []; }

    return {
        id: String(raw.id),
        groupId: String(raw.groupId),
        description: String(raw.description || ""),
        amount: Number(raw.amount) || 0,
        paidBy: String(raw.paidBy || ""),
        splits: splits,
        splitType: String(raw.splitType || "EQUAL"),
        createdAt: Number(raw.createdAt) || 0
    };
}

function response(data) {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
`;
