/**
 * AuthHelper.gs — shared auth utility
 *
 * Called from any layer that needs to know who is making the request.
 * Not a layer itself — a tool used by controllers and (occasionally) services.
 *
 * For the MVP this just returns the Google account email. Role-based
 * authorization comes later when the staff sheet is wired in.
 */

const AuthHelper = (function () {
  function getCurrentUser() {
    const email = Session.getActiveUser().getEmail();
    return {
      email: email || "unknown@local",
      // Role hardcoded for MVP. Replace with lookup against staff sheet.
      role: "appointment_staff",
    };
  }

  return {
    getCurrentUser: getCurrentUser,
  };
})();
