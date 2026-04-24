/**
 * Validators.gs — shared input validators
 *
 * Thin guards called by controllers before delegating to services.
 * Throws on invalid input with a message the user will see.
 */

const Validators = (function () {
  function requireBookingPayload(p) {
    if (!p) throw new Error("No booking data received.");
    if (!p.date) throw new Error("Date is required.");
    if (!p.bay) throw new Error("Bay is required.");
    if (!p.start) throw new Error("Start time is required.");
    if (!p.dur || Number(p.dur) <= 0)
      throw new Error("Duration must be greater than zero.");
    if (!p.lastName && !p.firstName)
      throw new Error("Customer name is required.");
    if (!p.plate) throw new Error("Plate number is required.");
    if (!p.type) throw new Error("Service type is required.");
  }

  return {
    requireBookingPayload: requireBookingPayload,
  };
})();
