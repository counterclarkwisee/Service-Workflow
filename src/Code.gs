/**
 * Code.gs — entry point
 *
 * Responsibilities:
 *   - Serve the HTML shell via doGet
 *   - Nothing else lives here; real work is delegated to controllers
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile("views/Index")
    .setTitle("Toyota Service Workflow")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Utility for the HTML template if you ever need to inline other HTML files.
 * Unused for now but keeps the door open.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getSkuModels() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("sku");

  // Get all data from Column A, starting at row 2
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange("A2:A" + lastRow).getValues();

  // Flatten into a 1D array and remove any empty rows
  return values.flat().filter((item) => item !== "");
}
