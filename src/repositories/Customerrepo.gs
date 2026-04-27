/**
 * CustomerRepo.gs — Data access for the master customer list
 */
const CustomerRepo = (function () {
  const SHEET_NAME = "customer_master";

  function listAll() {
    return SheetsHelper.readAllAsObjects(SHEET_NAME);
  }

  function insertBatch(rows) {
    if (rows.length === 0) return;
    // Maps objects back to the physical row structure
    const data = rows.map((r) => [
      r.customer_name,
      r.mobile,
      r.address,
      r.cs_number,
      r.plate_number,
      r.model,
    ]);
    const sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    sheet
      .getRange(sheet.getLastRow() + 1, 1, data.length, data[0].length)
      .setValues(data);
  }

  return {
    listAll: listAll,
    insertBatch: insertBatch,
  };
})();
