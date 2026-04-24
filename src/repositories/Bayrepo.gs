/**
 * BayRepo.gs — data access for the `bays` sheet
 *
 * Reference data. Read-only for the appointment module.
 */

const BayRepo = (function () {
  const SHEET_NAME = "bays";

  function listAll() {
    return SheetsHelper.readAllAsObjects(SHEET_NAME);
  }

  function listActive() {
    return listAll().filter(function (b) {
      // Sheets may return TRUE/FALSE as booleans or strings depending on format.
      return (
        b.is_active === true || String(b.is_active).toUpperCase() === "TRUE"
      );
    });
  }

  return {
    listAll: listAll,
    listActive: listActive,
  };
})();
