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
    if (lastRow < 2) return { categories: [], requests: {} };

    // Get Column H (Service Category) and Column I (Service Request)
    // Starting from Row 2 to skip headers
    const data = sheet.getRange(2, 8, lastRow - 1, 2).getValues();

    const categories = [];
    const mapping = {};

    data.forEach((row) => {
      const cat = String(row[0] || "").trim();
      const req = String(row[1] || "").trim();

      if (cat) {
        if (!categories.includes(cat)) categories.push(cat);
        if (!mapping[cat]) mapping[cat] = [];
        if (req && !mapping[cat].includes(req)) {
          mapping[cat].push(req);
        }
      }
    });

    return {
      categories: categories.sort(),
      requests: mapping,
    };
  }

  return { getMapping: getMapping };
})();
