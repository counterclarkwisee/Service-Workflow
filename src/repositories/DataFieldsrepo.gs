/**
 * DataFieldsRepo.gs
 */
const DataFieldsRepo = (function () {
  const SHEET_NAME = "data_fields";

  function getMapping() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return { categories: [], requests: {} };

    const lastRow = sheet.getLastRow();
    if (lastRow < 4) return { categories: [], requests: {} };

    // Get Column H (8) and Column I (9) starting from Row 4
    const data = sheet.getRange(4, 8, lastRow - 3, 2).getValues();

    const categories = [];
    const allRequests = []; // To store every unique item in Column I
    const mapping = {};

    data.forEach((row) => {
      const cat = String(row[0] || "").trim();
      const req = String(row[1] || "").trim();

      if (cat && !categories.includes(cat)) {
        categories.push(cat);
      }

      if (req) {
        if (!allRequests.includes(req)) {
          allRequests.push(req);
        }

        // Keep standard relational logic for categories like GJ
        if (cat) {
          if (!mapping[cat]) mapping[cat] = [];
          if (!mapping[cat].includes(req)) {
            mapping[cat].push(req);
          }
        }
      }
    });

    // OVERRIDE: Force EM and PMS to contain EVERYTHING from Column I
    if (categories.includes("EM")) {
      mapping["EM"] = allRequests;
    }
    if (categories.includes("PMS")) {
      mapping["PMS"] = allRequests;
    }

    return {
      categories: categories.sort(),
      requests: mapping,
    };
  }

  /**
   * NEW: Fetches the Source list from Column K (11), starting at Row 4
   */
  function getSourceList() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow < 4) return [];

    // Column K is 11, get values from row 4 down
    const values = sheet.getRange(4, 11, lastRow - 3, 1).getValues();

    return values.map((r) => String(r[0] || "").trim()).filter((v) => v !== "");
  }

  return {
    getMapping: getMapping,
    getSourceList: getSourceList,
  };
})();
