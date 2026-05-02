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
        olb_no: appt.olb_no || "", // Added mapping for UI retrieval
      });
    });

    // Fetch dynamic slot capacities from receiving_time_slots DB
    const receivingSlots = _getReceivingSlots(BRANCH_CODE);

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
      receivingSlots: receivingSlots, // Integrated dynamic slots
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

    // Update Category (O), Status (P)
    apptSheet.getRange(rowIndex, 15).setValue(p.category);
    apptSheet.getRange(rowIndex, 16).setValue(p.status);

    // Update Confirmations (Cols R & S)
    if (p.n1_conf === "Confirm") {
      apptSheet.getRange(rowIndex, 18).setValue("CONFIRMED");
    } else if (p.n1_conf) {
      apptSheet.getRange(rowIndex, 18).setValue(p.n1_conf.toUpperCase());
    }

    if (p.h1_conf === "Confirm") {
      apptSheet.getRange(rowIndex, 19).setValue("CONFIRMED");
    } else if (p.h1_conf) {
      apptSheet.getRange(rowIndex, 19).setValue(p.h1_conf.toUpperCase());
    }

    // Update Remarks (T) and OLB Number (U)
    apptSheet.getRange(rowIndex, 20).setValue(p.status_remarks);
    apptSheet.getRange(rowIndex, 21).setValue(p.olb_no || ""); // Column U

    // Update Audit Trail (Shifted to Z and AA based on shifted columns)
    apptSheet.getRange(rowIndex, 26).setValue(new Date()); // Column Z
    apptSheet.getRange(rowIndex, 27).setValue(userEmail); // Column AA

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
        reschedule_id: p.appointment_id,
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
      // VALIDATION: Only conflict if the specific bay is already taken at this time
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
    const activeBays = BayRepo.listActive();
    let availableBayId = null;

    // Logic: If a bay was explicitly selected (e.g. from Grid), try that first.
    // Otherwise (e.g. from Table), find any free bay.
    if (p.bay) {
      const conflict = _getConflictingBayName(p.bay, p.date, p.start);
      if (!conflict) availableBayId = p.bay;
    }

    if (!availableBayId) {
      for (let i = 0; i < activeBays.length; i++) {
        const bId = activeBays[i].bay_id;
        const conflict = _getConflictingBayName(bId, p.date, p.start);
        if (!conflict) {
          availableBayId = bId;
          break;
        }
      }
    }

    if (!availableBayId) {
      throw new Error(
        "Booking failed: All bays are fully occupied for " + p.start + ".",
      );
    }

    const now = new Date();
    const apptId = _generateId("APT");
    const serviceId = _generateId("SVC");
    const arrivalTime = p.apptArrival || _subtractMinutes(p.start, 30);

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
      service_category: p.category || "",
      status: "booked",
      reschedule_id: p.reschedule_id || "",
      source: p.source || "",
      status_remarks: "",
      olb_no: p.olb_no || "", // Saved to Column U via Repo insert
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
      original_bay_id: availableBayId,
      current_start_time: p.start,
      current_bay_id: availableBayId,
      status: "scheduled",
      last_modified_at: now,
      last_modified_by: user.email,
    };

    AppointmentRepo.insert(appointment);
    ServiceRepo.insert(service);
  }

  /**
   * Updates slot capacities in the receiving_time_slots sheet.
   */
  function updateSlotCapacities(updatedSlots) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("receiving_time_slots");
    if (!sheet) throw new Error("Sheet 'receiving_time_slots' not found.");

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    // Headers are at row 2
    const headers = sheet
      .getRange(2, 1, 1, lastCol)
      .getValues()[0]
      .map((h) => String(h).toUpperCase().trim());
    const branchColIdx = headers.indexOf(BRANCH_CODE.toUpperCase());

    if (branchColIdx === -1)
      throw new Error(
        "Branch column '" + BRANCH_CODE + "' not found in headers.",
      );

    const dataRange = sheet.getRange(3, 1, lastRow - 2, lastCol);
    const data = dataRange.getValues();

    updatedSlots.forEach((update) => {
      for (let i = 0; i < data.length; i++) {
        let rowTimeRaw = data[i][0];
        let rowTime = "";
        if (Object.prototype.toString.call(rowTimeRaw) === "[object Date]") {
          rowTime = Utilities.formatDate(rowTimeRaw, "Asia/Manila", "HH:mm");
        } else {
          rowTime = String(rowTimeRaw).trim();
        }

        if (rowTime === update.time) {
          // branchColIdx is 0-based, so branchColIdx + 1 is the column number.
          sheet.getRange(i + 3, branchColIdx + 1).setValue(update.capacity);
          break;
        }
      }
    });
    return getState();
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

  function _getReceivingSlots(branchCode) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("receiving_time_slots");
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) return [];

    const data = sheet
      .getRange(2, 1, lastRow - 1, sheet.getLastColumn())
      .getValues();
    const headers = data[0].map((h) => String(h).toUpperCase().trim());

    const branchColIdx = headers.indexOf(branchCode.toUpperCase());
    if (branchColIdx === -1) return [];

    const slots = [];
    for (let i = 1; i < data.length; i++) {
      const rawTime = data[i][0];
      const capacityRaw = data[i][branchColIdx];

      if (rawTime === "" || capacityRaw === "") continue;

      let capacity = parseInt(capacityRaw, 10);
      if (isNaN(capacity)) capacity = 0;

      let timeStr = "";
      if (Object.prototype.toString.call(rawTime) === "[object Date]") {
        timeStr = Utilities.formatDate(rawTime, "Asia/Manila", "HH:mm");
      } else {
        let s = String(rawTime).trim();
        let match = s.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (match) {
          let h = parseInt(match[1], 10);
          let m = match[2];
          let ampm = match[3].toUpperCase();
          if (ampm === "PM" && h < 12) h += 12;
          if (ampm === "AM" && h === 12) h = 0;
          timeStr = h.toString().padStart(2, "0") + ":" + m;
        } else {
          timeStr = s;
        }
      }
      slots.push({ time: timeStr, capacity: capacity });
    }
    return slots;
  }

  return {
    getState: getState,
    bookAppointment: bookAppointment,
    getRequiredRepairTime: getRequiredRepairTime,
    updateAppointmentStatus: updateAppointmentStatus,
    updateSlotCapacities: updateSlotCapacities, // Exposed for Code.gs call
  };
})();
