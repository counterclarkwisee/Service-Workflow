/**
 * Code.gs — entry point
 *
 * Responsibilities:
 *   - Serve the HTML shell via doGet
 *   - Nothing else lives here; real work is delegated to controllers
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile("Index")
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
