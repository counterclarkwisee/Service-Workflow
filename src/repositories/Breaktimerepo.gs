/**
 * BreaktimeRepo.gs
 * Handles data access for the 'breaktime' sheet.
 * Replaces the old UserRepo.
 */
const BreaktimeRepo = (function () {
  const SHEET_NAME = "breaktime";

  function getSheet() {
    return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  }

  /**
   * Fetches all members from the breaktime sheet filtered by position and dealer.
   */
  function findByPositionAndDealer(position, dealer) {
    const sheet = getSheet();
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    // Safety Check: If sheet is empty or only has headers (Row 1), return empty array
    if (lastRow < 2) return [];

    // Fetches columns A through J (10 columns) starting from row 2
    const data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();

    return data
      .filter((row) => {
        const rowDealer = String(row[0] || "")
          .trim()
          .toUpperCase();
        const rowPosition = String(row[1] || "").trim();
        const hasName = String(row[2] || "").trim() !== "";

        // Filter by Dealer, Position, and ensure name exists
        return (
          rowDealer === dealer.toUpperCase() &&
          rowPosition === position &&
          hasName
        );
      })
      .map((row) => {
        // Helper to ensure time values are strings (HH:mm)
        const formatTime = (val) => {
          if (val instanceof Date) {
            return Utilities.formatDate(
              val,
              Session.getScriptTimeZone(),
              "HH:mm",
            );
          }
          return String(val || "").trim();
        };

        return {
          dealer: String(row[0] || "").trim(), // Column A
          position: String(row[1] || "").trim(), // Column B
          team_member: String(row[2] || "").trim(), // Column C
          email_address: String(row[3] || "").trim(), // Column D
          shift: String(row[4] || "").trim(), // Column E
          assigned_bay: String(row[5] || "").trim(), // Column F
          am_break: formatTime(row[6]), // Column G
          lunch_break: formatTime(row[7]), // Column H
          pm_break: formatTime(row[8]), // Column I
          remarks: String(row[9] || "").trim(), // Column J
        };
      });
  }

  return {
    findByPositionAndDealer: findByPositionAndDealer,
  };
})();
