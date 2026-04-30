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

    const serviceData = DataFieldsRepo.getMapping();
    const sources = DataFieldsRepo.getSourceList();
    const gjCommonJobs = GJServiceRequestRepo.listCommonJobs();

    const customers = CustomerRepo.listAll();
    const uniqueCustomerNames = [
      ...new Set(customers.map((c) => c.customer_name)),
    ]
      .filter((name) => name)
      .sort();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const skuSheet = ss.getSheetByName("sku");
    let skuModels = [];
    if (skuSheet) {
      const lastRow = skuSheet.getLastRow();
      if (lastRow > 1) {
        const skuData = skuSheet.getRange("A2:A" + lastRow).getValues();
        skuModels = skuData
          .map((r) => String(r[0]).trim())
          .filter((m) => m !== "" && m !== "null" && m !== "undefined")
          .sort();
      }
    }

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
        service_category: appt.service_category || "", // Added to reflect in UI
        status: appt.status || s.status || "scheduled",
        lastName: appt.last_name,
        firstName: appt.first_name,
        contact: appt.client_phone,
        plate: appt.plate_number,
        csNo: appt.cs_no,
        model: appt.vehicle_model,
        year: appt.vehicle_year,
        advisor: appt.assigned_advisor_name || "",
        remarks: appt.remarks || "",
        assigneeLast: appt.assignee_last_name || "",
        assigneeFirst: appt.assignee_first_name || "",
        assigneeContact: appt.assignee_contact || "",
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
      skuModels: skuModels,
      gjCommonJobs: gjCommonJobs,
      sources: sources,
    };
  }

  function getRequiredRepairTime(model, kmSeries) {
    const allRequests = PMSServiceRequestRepo.listAll();
    const branch = BRANCH_CODE.toUpperCase();
    const normalize = (str) =>
      String(str || "")
        .toUpperCase()
        .replace(/CHECK\s*UP/g, "")
        .replace(/,/g, "")
        .replace(/\s+/g, "");
    const targetKm = normalize(kmSeries);
    const targetModel = String(model || "")
      .toUpperCase()
      .trim();

    const match = allRequests.find((r) => {
      const rowKm = normalize(r.km_series);
      const rowModelStr = String(r.model || "").toUpperCase();
      const rowBranch = String(r.branch || "").toUpperCase();
      const modelsArray = rowModelStr.split(",").map((m) => m.trim());
      return (
        rowKm === targetKm &&
        modelsArray.includes(targetModel) &&
        rowBranch.indexOf(branch) !== -1
      );
    });

    if (match) {
      const timeDigits = String(match.repair_time).replace(/[^0-9]/g, "");
      return timeDigits ? Number(timeDigits) : 60;
    }
    return 60;
  }

  function updateAppointmentStatus(p, user) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const apptSheet = ss.getSheetByName("appointments");
    const apptData = apptSheet.getDataRange().getValues();
    const userEmail =
      user && user.email ? user.email : Session.getActiveUser().getEmail();

    if (p.status === "Rescheduled" && p.newDate && p.newTime) {
      const newWorkshopStart = _addMinutes(p.newTime, 30);
      const conflict = _getConflictingBayName(
        p.bay,
        p.newDate,
        newWorkshopStart,
      );
      if (conflict) {
        throw new Error(
          "Cannot reschedule: " + conflict + " is already booked.",
        );
      }
    }

    let rowIndex = -1;
    for (let i = 1; i < apptData.length; i++) {
      if (apptData[i][0] === p.appointment_id) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) throw new Error("Appointment ID not found.");

    apptSheet.getRange(rowIndex, 15).setValue(p.status);
    apptSheet.getRange(rowIndex, 16).setValue(p.status_remarks);
    apptSheet.getRange(rowIndex, 22).setValue(new Date());
    apptSheet.getRange(rowIndex, 23).setValue(userEmail);

    if (p.status === "Canceled" || p.status === "Rescheduled") {
      const svcSheet = ss.getSheetByName("services");
      const svcData = svcSheet.getDataRange().getValues();
      for (let i = 1; i < svcData.length; i++) {
        if (svcData[i][1] === p.appointment_id) {
          svcSheet.getRange(i + 1, 12).setValue(p.status.toLowerCase());
          break;
        }
      }
    }

    if (p.status === "Rescheduled" && p.newDate && p.newTime) {
      const newWorkshopStart = _addMinutes(p.newTime, 30);
      const newP = {
        ...p,
        date: p.newDate,
        start: newWorkshopStart,
        apptArrival: p.newTime,
      };
      bookAppointment(newP, { email: userEmail });
    }

    return getState();
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
        s.status !== "cancelled" &&
        s.status !== "canceled" &&
        s.status !== "rescheduled"
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
      throw new Error(conflictingBayName + " is already booked for that time.");
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
      service_category: p.category || "", // Now mapped and stored
      source: p.source || "",
      status: "booked",
      status_remarks: "",
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

  function _addMinutes(timeStr, minsToAdd) {
    const [h, m] = timeStr.split(":").map(Number);
    let date = new Date();
    date.setHours(h, m, 0, 0);
    date.setMinutes(date.getMinutes() + minsToAdd);
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
    getRequiredRepairTime: getRequiredRepairTime,
    updateAppointmentStatus: updateAppointmentStatus,
  };
})();
