/**
 * AppointmentRepo.gs — data access for the `appointments` sheet
 *
 * This is the ONLY layer allowed to call SpreadsheetApp for the
 * appointments sheet. Services above call these methods; nothing else
 * touches SpreadsheetApp directly.
 *
 * Returns plain JS objects, not raw rows. Callers never think in columns.
 */

const AppointmentRepo = (function () {
  const SHEET_NAME = "appointments";

  function listAll() {
    return SheetsHelper.readAllAsObjects(SHEET_NAME);
  }

  function findById(appointmentId) {
    const rows = listAll();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].appointment_id === appointmentId) return rows[i];
    }
    return null;
  }

  function insert(appointmentObj) {
    SheetsHelper.appendObjectAsRow(SHEET_NAME, appointmentObj);
  }

  return {
    listAll: listAll,
    findById: findById,
    insert: insert,
  };
})();
