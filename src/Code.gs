/**
 * Code.gs — entry point
 * Responsibilities:
 * - Serve the HTML shell via doGet
 * - Handle state orchestration for the UI
 * - Central versioning management
 */

// CENTRAL VERSIONING - Update this number manually on every commit/release.
var APP_VERSION = "v2.0143";

function doGet(e) {
  // Ensure the path matches your file structure (views/Appointmentview)
  return HtmlService.createTemplateFromFile("views/Appointmentview")
    .evaluate()
    .setTitle("Toyota Service Workflow")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Main state fetcher for the UI.
 * Routes through AppointmentService and injects the current App Version.
 */
function getState() {
  try {
    const state = AppointmentService.getState();

    // Inject the version into the state object for the loading screen
    state.appVersion = APP_VERSION;

    return state;
  } catch (e) {
    console.error("Error in getState: " + e.message);
    throw new Error("Failed to fetch application state.");
  }
}

/**
 * BRIDGE FUNCTION: updateAppointmentStatus
 * Handles Rescheduling (creating new rows) and Canceling.
 */
function updateAppointmentStatus(payload) {
  try {
    const user = { email: Session.getActiveUser().getEmail() };
    return AppointmentService.updateAppointmentStatus(payload, user);
  } catch (e) {
    throw new Error("Update Failed: " + e.message);
  }
}

/**
 * BRIDGE FUNCTION: updateSlotCapacities
 * Updates the receiving time slot capacities (SA Adjustments)
 */
function updateSlotCapacities(payload) {
  try {
    return AppointmentService.updateSlotCapacities(payload);
  } catch (e) {
    throw new Error("Failed to update capacities: " + e.message);
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
 * Handles the booking of a brand new service
 */
function bookService(payload) {
  try {
    const user = { email: Session.getActiveUser().getEmail() };
    // Pass the work to the service layer
    AppointmentService.bookAppointment(payload, user);
    // Refresh the UI state (which will now include the version)
    return getState();
  } catch (e) {
    throw new Error("Failed to book service: " + e.message);
  }
}

/**
 * BRIDGE FUNCTION: Repair Time Lookup
 */
function getRequiredRepairTime(model, kmSeries) {
  return AppointmentService.getRequiredRepairTime(model, kmSeries);
}

/**
 * Utility for template inclusions (if using split files)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
