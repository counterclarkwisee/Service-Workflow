/**
 * Code.gs — entry point
 * * Responsibilities:
 * - Serve the HTML shell via doGet
 * - Handle state orchestration for the UI
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile("views/Index")
    .setTitle("Toyota Service Workflow")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Main state fetcher for the UI.
 * This combines your appointments, bays, and the service mapping.
 * It also now includes the Sku models so they are available immediately.
 */
function getState() {
  // Fetch relational mapping from DataFieldsRepo (Column H & I logic)
  const mapping = DataFieldsRepo.getMapping();

  // Fetch core models for the extraction matching logic
  const skuModels = getSkuModels();

  return {
    bays: BayRepo.listAll(),
    servicesByDate: AppointmentRepo.getServicesByDate(),
    advisors: AdvisorRepo.listAll(),
    serviceCategories: mapping.categories, // Used for Category dropdown
    serviceMapping: mapping.requests, // Relational data for Service Request
    skuModels: skuModels, // Used to match "Fortuner" from variant string
  };
}

/**
 * Fetches the list of core models from 'sku' sheet Column A
 */
function getSkuModels() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("sku");
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const values = sheet.getRange("A2:A" + lastRow).getValues();
    // Flatten and clean up empty rows
    return values.flat().filter((item) => item && String(item).trim() !== "");
  } catch (e) {
    console.error("Error in getSkuModels: " + e.message);
    return [];
  }
}

/**
 * Fetches the master list of customers for fuzzy matching
 */
function getCustomerData() {
  try {
    return CustomerRepo.listAll();
  } catch (e) {
    throw new Error("Failed to load customer database: " + e.message);
  }
}

/**
 * Handles the booking of the service
 */
function bookService(payload) {
  try {
    AppointmentRepo.save(payload);
    return getState(); // Return updated state to refresh the table and grid
  } catch (e) {
    throw new Error("Failed to book service: " + e.message);
  }
}

/**
 * Utility for template inclusions (if using split files)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getRequiredRepairTime(model, kmSeries) {
  return AppointmentService.getRequiredRepairTime(model, kmSeries);
}
