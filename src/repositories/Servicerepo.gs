/**
 * ServiceRepo.gs — data access for the `services` sheet
 *
 * Same contract as AppointmentRepo. Only layer that touches the services
 * sheet via SpreadsheetApp.
 */

const ServiceRepo = (function () {
  const SHEET_NAME = "services";

  function listAll() {
    return SheetsHelper.readAllAsObjects(SHEET_NAME);
  }

  function findById(serviceId) {
    const rows = listAll();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].service_id === serviceId) return rows[i];
    }
    return null;
  }

  function listByAppointment(appointmentId) {
    return listAll().filter(function (s) {
      return s.appointment_id === appointmentId;
    });
  }

  function insert(serviceObj) {
    SheetsHelper.appendObjectAsRow(SHEET_NAME, serviceObj);
  }

  return {
    listAll: listAll,
    findById: findById,
    listByAppointment: listByAppointment,
    insert: insert,
  };
})();
