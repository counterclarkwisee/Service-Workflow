/**
 * AppointmentService.gs — business logic layer
 *
 * Contains the rules of the business:
 *   - What fields get generated vs copied from the form
 *   - What the initial statuses are
 *   - How appointment + service rows are assembled together
 *   - What "state for the UI" means
 *
 * Services call repositories to read/write data. Services never touch
 * SpreadsheetApp directly — that's the repo's job.
 */

const AppointmentService = (function () {
  /**
   * Returns everything the browser needs to render the page.
   * { advisors, bays, servicesByDate }
   */
  function getState() {
    const bays = BayRepo.listActive();
    const services = ServiceRepo.listAll();
    const appointments = AppointmentRepo.listAll();

    // Join services with their parent appointments so the UI gets
    // denormalized rows (customer name, plate, etc. inline with service).
    const apptById = {};
    appointments.forEach(function (a) {
      apptById[a.appointment_id] = a;
    });

    const servicesByDate = {};
    services.forEach(function (s) {
      const appt = apptById[s.appointment_id];
      if (!appt) return;

      const date = appt.appointment_date;
      if (!servicesByDate[date]) servicesByDate[date] = [];

      servicesByDate[date].push({
        id: s.service_id,
        appointment_id: s.appointment_id,
        start: s.current_start_time,
        dur: Number(s.current_duration_minutes) || 60,
        bay: s.current_bay_id,
        type: s.service_type,
        status: s.status || "scheduled",
        lastName: appt.last_name,
        firstName: appt.first_name,
        contact: appt.client_phone,
        plate: appt.plate_number,
        model: appt.vehicle_model,
        year: appt.vehicle_year,
        advisor: appt.assigned_advisor_name || "",
      });
    });

    return {
      advisors: _getAdvisors(),
      bays: bays.map(function (b) {
        return { id: b.bay_id, name: b.bay_name, type: b.bay_type };
      }),
      servicesByDate: servicesByDate,
    };
  }

  /**
   * Creates an appointment + one service row from the booking payload.
   * Returns nothing; the controller calls getState() after to refresh the UI.
   */
  function bookAppointment(p, user) {
    const now = new Date();
    const apptId = _generateId("APT");
    const serviceId = _generateId("SVC");

    const appointment = {
      appointment_id: apptId,
      created_at: now,
      created_by: user.email,
      last_name: p.lastName || "",
      first_name: p.firstName || "",
      client_phone: p.contact || "",
      plate_number: p.plate || "",
      cs_no: p.csNo || "",
      vehicle_model: p.model || "",
      vehicle_year: p.year || "",
      appointment_date: p.date,
      scheduled_arrival_time: p.start,
      assigned_advisor_name: p.advisor || "",
      source: p.source || "Inbound",
      status: "booked",
      assignee_last_name: p.assigneeLast || "",
      assignee_first_name: p.assigneeFirst || "",
      assignee_contact: p.assigneeContact || "",
      remarks: p.remarks || "",
      last_modified_at: now,
      last_modified_by: user.email,
    };

    const service = {
      service_id: serviceId,
      appointment_id: apptId,
      created_at: now,
      created_by: user.email,
      service_type: p.type || "",
      estimated_duration_minutes: p.dur,
      current_duration_minutes: p.dur,
      original_start_time: p.start,
      original_bay_id: p.bay,
      current_start_time: p.start,
      current_bay_id: p.bay,
      status: "scheduled",
      last_modified_at: now,
      last_modified_by: user.email,
    };

    AppointmentRepo.insert(appointment);
    ServiceRepo.insert(service);
  }

  // --- private ---

  function _generateId(prefix) {
    const ts = new Date().getTime();
    const rand = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    return prefix + "-" + ts + "-" + rand;
  }

  function _getAdvisors() {
    // Hardcoded for MVP. Move to a `staff` sheet filtered by role later.
    return [
      { id: "SA001", name: "Cruz, Mark" },
      { id: "SA002", name: "Lim, Paolo" },
      { id: "SA003", name: "Reyes, Anna" },
      { id: "SA004", name: "Tan, Grace" },
      { id: "SA005", name: "Santos, Miguel" },
    ];
  }

  return {
    getState: getState,
    bookAppointment: bookAppointment,
  };
})();
