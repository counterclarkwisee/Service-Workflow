/**
 * CustomerService.gs — business logic layer
 * Column Reference:
 * 0: Customer Name | 1: Mobile | 2: Address | 3: CS Number | 4: Plate No. | 5: Model
 */
const CustomerService = (function () {
  function importMonthlyList() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const uploadSheet = ss.getSheetByName("customer_upload");
    const masterSheet = ss.getSheetByName("customer_master");

    if (!uploadSheet || !masterSheet) {
      throw new Error(
        "Ensure both 'customer_upload' and 'customer_master' sheets exist.",
      );
    }

    // 1. Build a "Database Map" from the Master list
    const masterData = masterSheet.getDataRange().getValues();
    const masterMap = new Map();

    // Start at i=1 to skip the header row
    for (let i = 1; i < masterData.length; i++) {
      const row = masterData[i];
      const key = _buildKey(row[3], row[4]); // Index 3 (CS), Index 4 (Plate)
      if (key) {
        masterMap.set(key, {
          mobile: String(row[1]).trim(),
          rowNumber: i + 1, // We need the physical row number for overwriting
        });
      }
    }

    // 2. Get data from the Upload sheet
    const uploadRange = uploadSheet.getDataRange();
    const uploadData = uploadRange.getValues();
    if (uploadData.length <= 1) {
      SpreadsheetApp.getUi().alert(
        "The 'customer_upload' sheet is already empty!",
      );
      return;
    }

    const newRowsToAppend = [];
    let skipCount = 0;
    let updateCount = 0;

    // 3. Loop through Upload data
    for (let i = 1; i < uploadData.length; i++) {
      const row = uploadData[i];
      const uploadKey = _buildKey(row[3], row[4]);
      const uploadMobile = String(row[1]).trim();

      if (!uploadKey) {
        skipCount++;
        continue;
      }

      // CHECK IF KEY EXISTS IN DATABASE
      if (masterMap.has(uploadKey)) {
        const existingRecord = masterMap.get(uploadKey);

        // REQUIREMENT 2.1: Check if mobile number is same
        if (uploadMobile !== existingRecord.mobile && uploadMobile !== "") {
          // OVERWRITE: Update only the Mobile cell (Column B = index 2)
          masterSheet
            .getRange(existingRecord.rowNumber, 2)
            .setValue(uploadMobile);

          // Update the map in case the same car appears twice in the upload file
          existingRecord.mobile = uploadMobile;
          updateCount++;
        } else {
          // SKIP: Exactly same data
          skipCount++;
        }
      } else {
        // REQUIREMENT 2: New Row
        newRowsToAppend.push([
          row[0], // Customer Name
          row[1], // Mobile
          row[2], // Address
          row[3], // CS Number
          row[4], // Plate No.
          row[5], // Model
        ]);

        // Add to map temporarily to prevent duplicates within the SAME upload file
        masterMap.set(uploadKey, { mobile: uploadMobile });
      }
    }

    // 4. Batch insert new rows
    if (newRowsToAppend.length > 0) {
      masterSheet
        .getRange(
          masterSheet.getLastRow() + 1,
          1,
          newRowsToAppend.length,
          newRowsToAppend[0].length,
        )
        .setValues(newRowsToAppend);
    }

    // --- HOUSEKEEPING: DELETE UPLOADED FILES EXCEPT HEADERS ---
    // We clear content from Row 2 down to the last row used
    const lastRow = uploadSheet.getLastRow();
    if (lastRow > 1) {
      uploadSheet
        .getRange(2, 1, lastRow - 1, uploadSheet.getLastColumn())
        .clearContent();
    }

    // 5. Final Report
    SpreadsheetApp.getUi().alert(
      "✅ PROCESS COMPLETE\n\n" +
        "Added: " +
        newRowsToAppend.length +
        " new cars.\n" +
        "Updated: " +
        updateCount +
        " mobile numbers.\n" +
        "Skipped: " +
        skipCount +
        " existing records.\n\n" +
        "The 'customer_upload' sheet has been cleared for next month.",
    );
  }

  function _buildKey(cs, plate) {
    const cleanCS = String(cs || "")
      .trim()
      .toUpperCase();
    const cleanPlate = String(plate || "")
      .trim()
      .toUpperCase();
    if (!cleanCS && !cleanPlate) return null;
    return cleanCS + "|" + cleanPlate;
  }

  return {
    importMonthlyList: importMonthlyList,
  };
})();
