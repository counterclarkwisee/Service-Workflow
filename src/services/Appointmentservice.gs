/**
 * AppointmentService.gs — business logic layer
 */
const AppointmentService = (function () {
  const BRANCH_CODE = "TLB";

  /**
   * Returns everything the browser needs to render the page.
   */
  function getState() {
    const bays = BayRepo.listActive();
    const services = ServiceRepo.listAll();
    const appointments = AppointmentRepo.listAll();

    // Fetch mapping from data_fields sheet
    const serviceData = DataFieldsRepo.getMapping();

    const customers = CustomerRepo.listAll();
    const uniqueCustomerNames = [
      ...new Set(customers.map((c) => c.customer_name)),
    ]
      .filter((name) => name)
      .sort();

    // --- NEW: Fetch SKU Models directly from the 'sku' sheet ---
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const skuSheet = ss.getSheetByName("sku");
    let skuModels = [];
    if (skuSheet) {
      const lastRow = skuSheet.getLastRow();
      if (lastRow > 1) {
        // Pulls Column A (Models) starting from row 2
        const skuData = skuSheet.getRange("A2:A" + lastRow).getValues();
        skuModels = skuData
          .map((r) => String(r[0]).trim())
          .filter((m) => m !== "" && m !== "null" && m !== "undefined")
          .sort();
      }
    }
    // ---------------------------------------------------------

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
        start: appt.scheduled_arrival_time,
        gridStart: s.current_start_time,
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
      customerNames: uniqueCustomerNames,
      serviceCategories: serviceData.categories,
      serviceMapping: serviceData.requests,
      skuModels: skuModels, // Sent to the UI for fuzzy matching
    };
  }

  function _getConflictingBayName(bayId, date, startTime) {
    const allServices = ServiceRepo.listAll();
    const allAppts = AppointmentRepo.listAll();
    const allBays = BayRepo.listActive();

    const apptDates = {};
    allAppts.forEach((a) => (apptDates[a.appointment_id] = a.appointment_date));

    const conflict = allServices.find((s) => {
      const sDate = apptDates[s.appointment_id];
      return (
        s.current_bay_id === bayId &&
        sDate === date &&
        s.current_start_time === startTime &&
        s.status !== "cancelled"
      );
    });

    if (conflict) {
      const bay = allBays.find((b) => b.bay_id === bayId);
      return bay ? bay.bay_name : bayId;
    }
    return null;
  }

  function bookAppointment(p, user) {
    const conflictingBayName = _getConflictingBayName(p.bay, p.date, p.start);

    if (conflictingBayName) {
      throw new Error(
        conflictingBayName +
          " is already booked for that time. Please pick another time.",
      );
    }

    const now = new Date();
    const apptId = _generateId("APT");
    const serviceId = _generateId("SVC");

    const arrivalTime = _subtractMinutes(p.start, 30);

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
      scheduled_arrival_time: arrivalTime,
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

  function _subtractMinutes(timeStr, minsToSubtract) {
    const [h, m] = timeStr.split(":").map(Number);
    let date = new Date();
    date.setHours(h, m, 0, 0);
    date.setMinutes(date.getMinutes() - minsToSubtract);

    return Utilities.formatDate(date, "Asia/Manila", "HH:mm");
  }

  function _generateId(prefix) {
    const ts = new Date().getTime();
    const rand = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    return prefix + "-" + ts + "-" + rand;
  }

  function _getAdvisors() {
    const allAdvisors = UserRepo.findByPosition("Service Advisor");
    const filteredAdvisors = allAdvisors.filter(function (u) {
      const dealerVal = String(u.dealer || "")
        .trim()
        .toUpperCase();
      return dealerVal === BRANCH_CODE.toUpperCase();
    });

    return filteredAdvisors.map((u) => ({
      name: (u.team_member || "Unknown Advisor").trim(),
    }));
  }

  return {
    getState: getState,
    bookAppointment: bookAppointment,
  };
})();
