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

    // Setup Meta Sheet
    let metaSheet = ss.getSheetByName("Meta");
    if (!metaSheet) {
        metaSheet = ss.insertSheet("Meta");
        metaSheet.appendRow(["Key", "Value"]);
    }

    // Setup Members Sheet
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
        }

        return response({ status: "error", message: "Invalid action" });
    } catch (err) {
        return response({ status: "error", message: err.toString() });
    }
}

function getAllData() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Meta
    const meta = {};
    const metaData = ss.getSheetByName("Meta").getDataRange().getValues();
    for (let i = 1; i < metaData.length; i++) {
        meta[metaData[i][0]] = metaData[i][1];
    }

    // Members
    const members = getData(ss.getSheetByName("Members"));

    // Expenses
    const expenses = getData(ss.getSheetByName("Expenses")).map(e => {
        // Parse JSON fields
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
        sheet.clearContents();
        sheet.appendRow(["Key", "Value"]);
        for (const [key, val] of Object.entries(payload.meta)) {
            sheet.appendRow([key, val]);
        }
    }

    // 2. Update Members
    if (payload.members) {
        const sheet = ss.getSheetByName("Members");
        sheet.clearContents();
        sheet.appendRow(["id", "username", "status"]);
        payload.members.forEach(m => {
            // flatten logic if needed, simplify for now
            sheet.appendRow([m.id, m.username, "active"]); // Simplified for sync
        });
    }

    // 3. Update Expenses
    if (payload.expenses) {
        const sheet = ss.getSheetByName("Expenses");
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

    return response({ status: "success" });
}

// Helpers
function getData(sheet) {
    const rows = sheet.getDataRange().getValues();
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
