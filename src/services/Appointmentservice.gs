/**
 * AppointmentService.gs — Optimized business logic layer
 */
const AppointmentService = (function () {
  const BRANCH_CODE = "TLB";

  function getState() {
    // 1. Fetch all static/mapping data in parallel (if possible, but Repo-based is fine)
    const bays = BayRepo.listActive();
    const services = ServiceRepo.listAll();
    const appointments = AppointmentRepo.listAll();
    const serviceData = DataFieldsRepo.getMapping();
    const sources = DataFieldsRepo.getSourceList();
    const gjCommonJobs = GJServiceRequestRepo.listCommonJobs();

    // 2. Faster unique filtering for customers
    const uniqueCustomerNames = [
      ...new Set(CustomerRepo.listAll().map((c) => c.customer_name)),
    ]
      .filter(Boolean)
      .sort();

    // 3. Optimized SKU fetching
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const skuSheet = ss.getSheetByName("sku");
    let skuModels = [];
    if (skuSheet) {
      const lastRow = skuSheet.getLastRow();
      if (lastRow > 1) {
        skuModels = skuSheet
          .getRange(2, 1, lastRow - 1, 1)
          .getValues()
          .map((r) => String(r[0]).trim())
          .filter((m) => m && m !== "null" && m !== "undefined")
          .sort();
      }
    }

    // 4. Create a Map for O(1) appointment lookup
    const apptById = appointments.reduce((acc, a) => {
      acc[a.appointment_id] = a;
      return acc;
    }, {});

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
        service_category: appt.service_category || "",
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
        n1d_status: appt.n1d_confirmation || "",
        n1h_status: appt.n1h_confirmation || "",
        olb_no: appt.olb_no || "",
      });
    });

    const receivingSlots = _getReceivingSlots(BRANCH_CODE);

    return {
      branchCode: BRANCH_CODE,
      advisors: _getAdvisors(),
      bays: bays.map((b) => ({
        id: b.bay_id,
        name: b.bay_name,
        type: b.bay_type,
      })),
      servicesByDate: servicesByDate,
      customerNames: uniqueCustomerNames,
      serviceCategories: serviceData.categories,
      serviceMapping: serviceData.requests,
      skuModels: skuModels,
      gjCommonJobs: gjCommonJobs,
      sources: sources,
      receivingSlots: receivingSlots,
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
      const rowModelStr = String(r.model || "").toUpperCase();
      return (
        normalize(r.km_series) === targetKm &&
        rowModelStr
          .split(",")
          .map((m) => m.trim())
          .includes(targetModel) &&
        String(r.branch || "")
          .toUpperCase()
          .includes(branch)
      );
    });

    return match
      ? Number(String(match.repair_time).replace(/[^0-9]/g, "")) || 60
      : 60;
  }

  /**
   * UPDATED: Now returns a simple status instead of full state refresh to eliminate 20s+ delay.
   */
  function updateAppointmentStatus(p, user) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const apptSheet = ss.getSheetByName("appointments");

    // Only fetch ID column to find row (Faster than fetching whole sheet)
    const idColumn = apptSheet.getRange("A:A").getValues();
    const userEmail = user?.email || Session.getActiveUser().getEmail();

    if (p.status === "Rescheduled" && p.newDate && p.newTime) {
      const newWorkshopStart = _addMinutes(p.newTime, 30);
      const conflict = _getConflictingBayName(
        p.bay,
        p.newDate,
        newWorkshopStart,
      );
      if (conflict)
        throw new Error("Conflict: " + conflict + " is already booked.");
    }

    let rowIndex = -1;
    for (let i = 1; i < idColumn.length; i++) {
      if (idColumn[i][0] === p.appointment_id) {
        rowIndex = i + 1;
        break;
      }
    }
    if (rowIndex === -1) throw new Error("ID not found.");

    const n1 =
      p.n1_conf === "Confirm"
        ? "CONFIRMED"
        : p.n1_conf
          ? p.n1_conf.toUpperCase()
          : "";
    const h1 =
      p.h1_conf === "Confirm"
        ? "CONFIRMED"
        : p.h1_conf
          ? p.h1_conf.toUpperCase()
          : "";

    // Batch set: Status (P), Arrival Date (Q), N1 (R), H1 (S), Remarks (T), OLB (U)
    apptSheet
      .getRange(rowIndex, 16, 1, 6)
      .setValues([
        [p.status, p.date, n1, h1, p.status_remarks, p.olb_no || ""],
      ]);

    // Audit Trail Update
    apptSheet.getRange(rowIndex, 26, 1, 2).setValues([[new Date(), userEmail]]);

    // Sync Services status if needed
    if (p.status === "Canceled" || p.status === "Rescheduled") {
      const svcSheet = ss.getSheetByName("services");
      const svcIdColumn = svcSheet.getRange("B:B").getValues();
      for (let i = 1; i < svcIdColumn.length; i++) {
        if (svcIdColumn[i][0] === p.appointment_id) {
          svcSheet.getRange(i + 1, 12).setValue(p.status.toLowerCase());
          break;
        }
      }
    }

    if (p.status === "Rescheduled" && p.newDate && p.newTime) {
      bookAppointment(
        {
          ...p,
          date: p.newDate,
          start: _addMinutes(p.newTime, 30),
          apptArrival: p.newTime,
          reschedule_id: p.appointment_id,
          status: "booked",
        },
        { email: userEmail },
      );
    }

    return { success: true };
  }

  function _getConflictingBayName(bayId, date, startTime) {
    const allServices = ServiceRepo.listAll();
    const appts = AppointmentRepo.listAll().reduce((acc, a) => {
      acc[a.appointment_id] = a.appointment_date;
      return acc;
    }, {});

    const conflict = allServices.find(
      (s) =>
        s.current_bay_id === bayId &&
        appts[s.appointment_id] === date &&
        s.current_start_time === startTime &&
        !["cancelled", "canceled", "rescheduled"].includes(
          (s.status || "").toLowerCase(),
        ),
    );

    if (conflict) {
      const bay = BayRepo.listActive().find((b) => b.bay_id === bayId);
      return bay ? bay.bay_name : bayId;
    }
    return null;
  }

  function bookAppointment(p, user) {
    const activeBays = BayRepo.listActive();
    let availableBayId = null;

    if (p.bay && !_getConflictingBayName(p.bay, p.date, p.start)) {
      availableBayId = p.bay;
    } else {
      const busyBays = _getBusyBaysForTime(p.date, p.start);
      const freeBay = activeBays.find((b) => !busyBays.includes(b.bay_id));
      if (freeBay) availableBayId = freeBay.bay_id;
    }

    if (!availableBayId)
      throw new Error("Booking failed: All bays occupied at " + p.start);

    const now = new Date();
    const apptId = _generateId("APT");
    const arrivalTime = p.apptArrival || _subtractMinutes(p.start, 30);

    AppointmentRepo.insert({
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
      service_category: p.category || "",
      status: p.status || "booked",
      reschedule_id: p.reschedule_id || "",
      source: p.source || "",
      status_remarks: "",
      olb_no: p.olb_no || "",
      assignee_last_name: p.assigneeLast || "",
      assignee_first_name: p.assigneeFirst || "",
      assignee_contact: p.assigneeContact || "",
      remarks: p.remarks || "",
      last_modified_at: now,
      last_modified_by: user.email,
    });

    ServiceRepo.insert({
      service_id: _generateId("SVC"),
      appointment_id: apptId,
      created_at: now,
      created_by: user.email,
      service_type: p.type || "",
      estimated_duration_minutes: p.dur,
      current_duration_minutes: p.dur,
      original_start_time: p.start,
      original_bay_id: availableBayId,
      current_start_time: p.start,
      current_bay_id: availableBayId,
      status: "scheduled",
      last_modified_at: now,
      last_modified_by: user.email,
    });
  }

  function _getBusyBaysForTime(date, time) {
    return ServiceRepo.listAll()
      .filter(
        (s) =>
          s.current_start_time === time &&
          !["canceled", "rescheduled"].includes(s.status),
      )
      .map((s) => s.current_bay_id);
  }

  function updateSlotCapacities(updatedSlots) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("receiving_time_slots");
    const data = sheet.getDataRange().getValues();
    const headers = data[1].map((h) => String(h).toUpperCase().trim());
    const branchColIdx = headers.indexOf(BRANCH_CODE.toUpperCase());

    updatedSlots.forEach((update) => {
      for (let i = 2; i < data.length; i++) {
        let rowTime =
          Object.prototype.toString.call(data[i][0]) === "[object Date]"
            ? Utilities.formatDate(data[i][0], "Asia/Manila", "HH:mm")
            : String(data[i][0]).trim();
        if (rowTime === update.time) {
          sheet.getRange(i + 1, branchColIdx + 1).setValue(update.capacity);
          break;
        }
      }
    });
    return getState();
  }

  function _subtractMinutes(timeStr, mins) {
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m - mins, 0, 0);
    return Utilities.formatDate(d, "Asia/Manila", "HH:mm");
  }

  function _addMinutes(timeStr, mins) {
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m + mins, 0, 0);
    return Utilities.formatDate(d, "Asia/Manila", "HH:mm");
  }

  function _generateId(prefix) {
    return (
      prefix +
      "-" +
      new Date().getTime() +
      "-" +
      Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")
    );
  }

  function _getAdvisors() {
    try {
      return (
        BreaktimeRepo.findByPositionAndDealer("Service Advisor", BRANCH_CODE) ||
        []
      ).map((u) => ({
        name: String(u.team_member || "Unknown").trim(),
        shift: u.shift,
        breaks: { am: u.am_break, lunch: u.lunch_break, pm: u.pm_break },
      }));
    } catch (e) {
      return [];
    }
  }

  function _getReceivingSlots(branchCode) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      "receiving_time_slots",
    );
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    const branchColIdx = data[1]
      .map((h) => String(h).toUpperCase().trim())
      .indexOf(branchCode.toUpperCase());
    if (branchColIdx === -1) return [];

    return data
      .slice(2)
      .map((row) => {
        const timeStr =
          Object.prototype.toString.call(row[0]) === "[object Date]"
            ? Utilities.formatDate(row[0], "Asia/Manila", "HH:mm")
            : String(row[0]).trim();
        return {
          time: timeStr,
          capacity: parseInt(row[branchColIdx], 10) || 0,
        };
      })
      .filter((s) => s.time);
  }

  return {
    getState,
    bookAppointment,
    getRequiredRepairTime,
    updateAppointmentStatus,
    updateSlotCapacities,
  };
})();
