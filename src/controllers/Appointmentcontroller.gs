/**
 * AppointmentController.gs — API layer (the "controllers")
 *
 * These are the functions the browser calls via google.script.run.
 * Controllers are thin: they authenticate, validate input, delegate to
 * services, and return the response. No business logic here.
 *
 * Architectural rule: Controllers -> Services -> Repositories -> Sheets.
 * No skipping, no reversing.
 */

/**
 * Returns the full state needed to render the page.
 * Shape: { advisors, bays, servicesByDate }
 *
 * Called by the browser on load and after every mutation.
 */
function getState() {
  try {
    return AppointmentService.getState();
  } catch (err) {
    console.error("getState failed:", err);
    throw new Error("Could not load state: " + err.message);
  }
}

/**
 * Creates a new appointment + service from the booking form payload.
 * Returns the updated state so the browser can re-render immediately.
 *
 * @param {Object} payload - form data from the booking drawer
 * @return {Object} updated state
 */
function bookService(payload) {
  const lock = LockService.getScriptLock();
  try {
    // Wait up to 10 seconds for the lock. Writes are gated to prevent races.
    lock.waitLock(10000);

    // Minimal validation at the controller boundary.
    // Deeper validation (business rules) happens in the service.
    Validators.requireBookingPayload(payload);

    const user = AuthHelper.getCurrentUser();
    AppointmentService.bookAppointment(payload, user);

    // Return fresh state so the UI re-renders with the new booking visible.
    return AppointmentService.getState();
  } catch (err) {
    console.error("bookService failed:", err);
    throw new Error("Booking failed: " + err.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Reset endpoint — kept for compatibility with the demo UI's Reset button.
 * Now a no-op since state lives in Sheets. Just returns current state.
 */
function resetDemo() {
  return AppointmentService.getState();
}
