const GJServiceRequestRepo = (function () {
  const SHEET_NAME = "gj_service_request";

  function getSheet() {
    return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  }

  /**
   * Fetches the GJ list from Column A, starting at Row 3
   */
  function listCommonJobs() {
    const sheet = getSheet();
    if (!sheet) return [];

    // Get Column A starting from row 3 to the end
    const lastRow = sheet.getLastRow();
    if (lastRow < 3) return [];

    const values = sheet.getRange(3, 1, lastRow - 2, 1).getValues();

    // Flatten the 2D array and remove empty rows
    return values.map((r) => String(r[0]).trim()).filter((v) => v !== "");
  }

  return {
    listCommonJobs: listCommonJobs,
  };
})();
