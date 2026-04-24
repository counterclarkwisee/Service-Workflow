/**
 * SheetsHelper.gs — shared row/object conversion utilities
 *
 * This is the lowest-level helper used by every repository. It's the ONE
 * place that knows how to map between SpreadsheetApp rows (arrays) and
 * plain JS objects (keyed by header row).
 *
 * Every repo calls this. Nothing above the repo layer should.
 */

const SheetsHelper = (function () {
  function _getSheet(name) {
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName(name);
    if (!sheet) {
      throw new Error("Sheet not found: " + name);
    }
    return sheet;
  }

  /**
   * Reads every row of a sheet and returns an array of objects keyed by
   * the header row. Empty rows are skipped.
   */
  function readAllAsObjects(sheetName) {
    const sheet = _getSheet(sheetName);
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return []; // only header or empty

    const headers = values[0];
    const rows = values.slice(1);
    const result = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Skip fully empty rows
      if (
        row.every(function (c) {
          return c === "" || c === null;
        })
      )
        continue;

      const obj = {};
      for (let j = 0; j < headers.length; j++) {
        const key = headers[j];
        if (!key) continue;
        let val = row[j];
        // Format Date objects to ISO date strings for date-only columns.
        // Times arrive as Date too; we format them as HH:mm strings.
        if (val instanceof Date) {
          val = _formatDateCell(val, key);
        }
        obj[key] = val;
      }
      result.push(obj);
    }
    return result;
  }

  /**
   * Appends a row to a sheet, using the sheet's header row to determine
   * column order. Missing keys are written as empty cells.
   */
  function appendObjectAsRow(sheetName, obj) {
    const sheet = _getSheet(sheetName);
    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
    const row = headers.map(function (h) {
      if (!h) return "";
      const v = obj[h];
      return v === undefined || v === null ? "" : v;
    });
    sheet.appendRow(row);
  }

  /**
   * Dates from Sheets come back as full Date objects even when the column
   * is meant to hold just a date or just a time. We format based on what
   * the column name suggests it holds.
   */
  function _formatDateCell(date, columnName) {
    const tz = Session.getScriptTimeZone() || "Asia/Manila";
    const n = String(columnName).toLowerCase();

    // Time-of-day columns -> HH:mm
    if (n.indexOf("time") !== -1 && n.indexOf("timestamp") === -1) {
      return Utilities.formatDate(date, tz, "HH:mm");
    }
    // Date-only columns -> YYYY-MM-DD
    if (n.indexOf("date") !== -1) {
      return Utilities.formatDate(date, tz, "yyyy-MM-dd");
    }
    // Full timestamps (created_at, last_modified_at, etc.) -> ISO-ish
    return Utilities.formatDate(date, tz, "yyyy-MM-dd HH:mm:ss");
  }

  return {
    readAllAsObjects: readAllAsObjects,
    appendObjectAsRow: appendObjectAsRow,
  };
})();
