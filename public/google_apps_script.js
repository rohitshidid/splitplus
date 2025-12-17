/**
 * Splitplus Database Script
 * 
 * Instructions:
 * 1. Create a new Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this code entirely.
 * 4. Run the 'setup' function once to initialize sheets.
 * 5. Deploy > New Deployment > Type: Web App.
 * 6. Configuration:
 *    - Description: Splitplus API
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 7. Copy the 'Web App URL' and use it in the Splitplus App.
 */

function setup() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Setup Meta Sheet (Group Info)
    let metaSheet = ss.getSheetByName("Meta");
    if (!metaSheet) {
        metaSheet = ss.insertSheet("Meta");
        metaSheet.appendRow(["Key", "Value"]);
    }

    // Setup Members Sheet (Group Members)
    let memSheet = ss.getSheetByName("Members");
    if (!memSheet) {
        memSheet = ss.insertSheet("Members");
        memSheet.appendRow(["id", "username", "status"]); // status: active, pending, requested
    }

    // Setup Expenses Sheet
    let expSheet = ss.getSheetByName("Expenses");
    if (!expSheet) {
        expSheet = ss.insertSheet("Expenses");
        expSheet.appendRow(["id", "groupId", "description", "amount", "paidBy", "splits", "splitType", "createdAt"]);
    }

    // Setup Users Sheet (Global Auth)
    let usersSheet = ss.getSheetByName("Users");
    if (!usersSheet) {
        usersSheet = ss.insertSheet("Users");
        usersSheet.appendRow(["id", "username", "password", "createdAt"]);
    }
}

function doGet(e) {
    const action = e.parameter.action;

    if (action === "GET_ALL") {
        return getAllData();
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid action" })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const action = data.action;

        if (action === "SYNC_GROUP") {
            return syncGroup(data.payload);
        } else if (action === "SIGNUP") {
            return registerUser(data.payload);
        } else if (action === "LOGIN") {
            return loginUser(data.payload);
        }

        return response({ status: "error", message: "Invalid action" });
    } catch (err) {
        return response({ status: "error", message: err.toString() });
    }
}

// --- Group Sync ---

function getAllData() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Meta
    const meta = {};
    const metaSheet = ss.getSheetByName("Meta");
    if (metaSheet) {
        const metaData = metaSheet.getDataRange().getValues();
        for (let i = 1; i < metaData.length; i++) {
            if (metaData[i][0]) meta[metaData[i][0]] = metaData[i][1];
        }
    }

    // Members
    const members = getData(ss.getSheetByName("Members"));

    // Expenses
    const expenses = getData(ss.getSheetByName("Expenses")).map(e => {
        try { e.splits = JSON.parse(e.splits); } catch (x) { e.splits = []; }
        return e;
    });

    return response({
        status: "success",
        data: {
            meta,
            members,
            expenses
        }
    });
}

function syncGroup(payload) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Update Meta
    if (payload.meta) {
        const sheet = ss.getSheetByName("Meta");
        if (sheet) {
            sheet.clearContents();
            sheet.appendRow(["Key", "Value"]);
            for (const [key, val] of Object.entries(payload.meta)) {
                // Handle array fields like pendingMembers/joinRequests by JSON stringifying if needed, 
                // but here it's cleaner to put them in the Members tab with status.
                // However, the payload.meta usually just has id, name, createdBy.
                // We will handle pending/requests in Members tab via 'status'.
                sheet.appendRow([key, val]);
            }
        }
    }

    // 2. Update Members (Active, Pending, Requests)
    if (payload.members) {
        const sheet = ss.getSheetByName("Members");
        if (sheet) {
            sheet.clearContents();
            sheet.appendRow(["id", "username", "status"]);

            // payload.members should be an array of { id, username, status }
            // If the app sends just active members in one list, we need to adjust.
            // But let's assume the app sends a unified list or we handle it here.
            // For simplicity, the app will send a list of objects exactly matching columns.
            payload.members.forEach(m => {
                sheet.appendRow([m.id, m.username, m.status || "active"]);
            });
        }
    }

    // 3. Update Expenses
    if (payload.expenses) {
        const sheet = ss.getSheetByName("Expenses");
        if (sheet) {
            sheet.clearContents();
            sheet.appendRow(["id", "groupId", "description", "amount", "paidBy", "splits", "splitType", "createdAt"]);
            payload.expenses.forEach(e => {
                sheet.appendRow([
                    e.id,
                    e.groupId,
                    e.description,
                    e.amount,
                    e.paidBy,
                    JSON.stringify(e.splits),
                    e.splitType,
                    e.createdAt
                ]);
            });
        }
    }

    return response({ status: "success" });
}

// --- Auth ---

function registerUser(user) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Users");
    if (!sheet) return response({ status: "error", message: "Users sheet missing" });

    const users = getData(sheet);
    if (users.find(u => u.username === user.username)) {
        return response({ status: "error", message: "Username already exists" });
    }

    sheet.appendRow([user.id, user.username, user.password, new Date().toISOString()]);
    return response({ status: "success", user: { id: user.id, username: user.username } });
}

function loginUser(creds) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Users");
    if (!sheet) return response({ status: "error", message: "Users sheet missing" });

    const users = getData(sheet);
    const found = users.find(u => u.username === creds.username && u.password === creds.password);

    if (found) {
        return response({ status: "success", user: { id: found.id, username: found.username } });
    } else {
        return response({ status: "error", message: "Invalid credentials" });
    }
}

// Helpers
function getData(sheet) {
    if (!sheet) return [];
    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return []; // Header only
    const headers = rows[0];
    const data = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const obj = {};
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = row[j];
        }
        data.push(obj);
    }
    return data;
}

function response(data) {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
