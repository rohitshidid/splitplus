export const GOOGLE_APPS_SCRIPT_SOURCE = `/**
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
        usersSheet.appendRow(["id", "username", "password", "createdAt", "groups", "groupLinks"]);
    } else {
        // Migration: Ensure columns exist if sheet exists
        const headers = usersSheet.getRange(1, 1, 1, usersSheet.getLastColumn()).getValues()[0];
        if (!headers.includes("groups")) usersSheet.getRange(1, headers.length + 1).setValue("groups");
        if (!headers.includes("groupLinks")) usersSheet.getRange(1, headers.length + 2).setValue("groupLinks");
    }
}

function doGet(e) {
    const action = e.parameter.action;

    if (action === "GET_ALL") {
        return getAllData();
    } else if (action === "GET_USER_GROUPS") {
        return getUserGroups(e.parameter.userId);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid action" })).setMimeType(ContentService.MimeType.JSON);
}

function getUserGroups(userId) {
    if (!userId) return response({ status: "error", message: "Missing userId" });
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Users");
    if (!sheet) return response({ status: "error", message: "Sheet missing" });

    const users = getData(sheet);
    const user = users.find(u => u.id === userId);
    
    if (user) {
         return response({ 
            status: "success", 
            groups: user.groups ? JSON.parse(user.groups) : [],
            groupLinks: user.groupLinks ? JSON.parse(user.groupLinks) : {}
        });
    }
    return response({ status: "error", message: "User not found" });
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
        } else if (action === "ADD_USER_GROUP") {
            return addUserGroup(data.payload);
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

    sheet.appendRow([user.id, user.username, user.password, new Date().toISOString(), "[]", "{}"]);
    return response({ status: "success", user: { id: user.id, username: user.username } });
}

function loginUser(creds) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Users");
    if (!sheet) return response({ status: "error", message: "Users sheet missing" });

    const users = getData(sheet);
    const found = users.find(u => u.username === creds.username && u.password === creds.password);

    if (found) {
        return response({ 
            status: "success", 
            user: { id: found.id, username: found.username },
            groups: found.groups ? JSON.parse(found.groups) : [],
            groupLinks: found.groupLinks ? JSON.parse(found.groupLinks) : {}
        });
    } else {
        return response({ status: "error", message: "Invalid credentials" });
    }
}

function addUserGroup(payload) {
    const userId = payload.userId;
    const groupId = payload.groupId;
    const groupLink = payload.groupLink;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Users");
    if (!sheet) return response({ status: "error", message: "Users sheet missing" });

    const data = sheet.getDataRange().getValues();
    // Headers are row 0
    let idCol = -1, groupsCol = -1, linksCol = -1;
    data[0].forEach((h, i) => {
        if (h === "id") idCol = i;
        if (h === "groups") groupsCol = i;
        if (h === "groupLinks") linksCol = i;
    });

    if (idCol === -1 || groupsCol === -1 || linksCol === -1) {
        return response({ status: "error", message: "Schema mismatch (missing columns)" });
    }

    for (let i = 1; i < data.length; i++) {
        if (data[i][idCol] === userId) {
            let groups = [];
            try { groups = JSON.parse(data[i][groupsCol]); } catch (e) {}
            if (!Array.isArray(groups)) groups = [];

            let links = {};
            try { links = JSON.parse(data[i][linksCol]); } catch (e) {}

            if (!groups.includes(groupId)) groups.push(groupId);
            if (groupLink) links[groupId] = groupLink;

            sheet.getRange(i + 1, groupsCol + 1).setValue(JSON.stringify(groups));
            sheet.getRange(i + 1, linksCol + 1).setValue(JSON.stringify(links));
            return response({ status: "success" });
        }
    }

    return response({ status: "error", message: "User not found" });
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
`;
