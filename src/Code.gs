/**
 * Code.gs — entry point
 * Responsibilities:
 * - Serve the HTML shell via doGet
 * - Handle state orchestration for the UI
 */

function doGet(e) {
  // Ensure the path matches your file structure (views/Appointmentview)
  return HtmlService.createHtmlOutputFromFile("views/Appointmentview")
    .setTitle("Toyota Service Workflow")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Main state fetcher for the UI.
 * Now routes through AppointmentService to ensure logic consistency.
 */
function getState() {
  try {
    return AppointmentService.getState();
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
    // Refresh the UI state
    return AppointmentService.getState();
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
