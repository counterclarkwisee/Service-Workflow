const PMSServiceRequestRepo = (function () {
  const SHEET_NAME = "pms_service_request";

  function getSheet() {
    return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  }

  /**
   * Fetches all rows from the sheet and returns them as objects
   */
  function listAll() {
    const sheet = getSheet();
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    return data.slice(1).map((row) => {
      return {
        km_series: row[0], // Col A
        model: row[2], // Col C
        branch: row[3], // Col D
        repair_time: row[6], // Col G
      };
    });
  }

  return {
    listAll: listAll,
  };
})();
