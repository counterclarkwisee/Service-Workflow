/**
 * BreaktimeRepo.gs
 * Handles data access for the 'breaktime' sheet.
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
    // Safety Check: If sheet is empty or only has headers (less than row 4), return empty array
    if (lastRow < 4) return [];

    // Fetches columns A through I starting from row 4
    const data = sheet.getRange(4, 1, lastRow - 3, 9).getValues();

    return data
      .filter((row) => {
        const rowDealer = String(row[0] || "")
          .trim()
          .toUpperCase();
        const rowPosition = String(row[1] || "").trim();
        const hasName = String(row[2] || "").trim() !== "";

        // Filter by Dealer (TLB/TLC), Position (Service Advisor), and ensure name exists
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
          dealer: String(row[0] || "").trim(),
          position: String(row[1] || "").trim(),
          team_member: String(row[2] || "").trim(),
          shift: String(row[3] || "").trim(), // Column D: e.g., "6:00 - 15:00"
          am_break: formatTime(row[5]), // Column F
          lunch: formatTime(row[6]), // Column G
          pm_break: formatTime(row[7]), // Column H
        };
      });
  }

  return {
    findByPositionAndDealer: findByPositionAndDealer,
  };
})();
