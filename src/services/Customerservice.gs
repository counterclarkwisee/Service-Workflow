/**
 * CustomerService.gs — Handles the logic of deduplication and importing
 */
const CustomerService = (function () {
  /**
   * Main function to be called every month.
   * Scans 'customer_upload' and moves unique rows to 'customer_master'.
   */
  function importMonthlyList() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const uploadSheet = ss.getSheetByName("customer_upload");

    if (!uploadSheet)
      throw new Error("Please create a 'customer_upload' sheet first.");

    // 1. Get New Data from Upload Sheet
    // Assumes headers are in Row 1, data starts Row 2
    const uploadData = uploadSheet.getDataRange().getValues();
    if (uploadData.length <= 1) {
      SpreadsheetApp.getUi().alert("Upload sheet is empty!");
      return;
    }

    // 2. Get Existing Data from Master
    const existingCustomers = CustomerRepo.listAll();

    // 3. Create a "Map" of existing keys for lightning-fast checking
    // Key = CS_Number + "|" + Plate_Number
    const existingKeys = new Set(
      existingCustomers.map(
        (c) =>
          String(c.cs_number).trim().toUpperCase() +
          "|" +
          String(c.plate_number).trim().toUpperCase(),
      ),
    );

    const newRowsToAppend = [];
    let skipCount = 0;

    // 4. Process the uploaded data (Start from index 1 to skip headers)
    for (let i = 1; i < uploadData.length; i++) {
      const row = uploadData[i];

      const customerObj = {
        customer_name: row[0], // Column A
        mobile: row[1], // Column B
        address: row[2], // Column C
        cs_number: row[3], // Column D
        plate_number: row[4], // Column E
        model: row[5], // Column F
      };

      const key =
        String(customerObj.cs_number).trim().toUpperCase() +
        "|" +
        String(customerObj.plate_number).trim().toUpperCase();

      if (existingKeys.has(key)) {
        skipCount++;
      } else {
        newRowsToAppend.push(customerObj);
        existingKeys.add(key); // Prevent duplicates within the same upload file
      }
    }

    // 5. Execute the Insert
    if (newRowsToAppend.length > 0) {
      CustomerRepo.insertBatch(newRowsToAppend);
      // Optional: Clear the upload sheet after successful import
      // uploadSheet.getRange(2, 1, uploadSheet.getLastRow(), uploadSheet.getLastColumn()).clearContent();

      SpreadsheetApp.getUi().alert(
        "Import Complete!\n" +
          "Added: " +
          newRowsToAppend.length +
          " new customers.\n" +
          "Skipped: " +
          skipCount +
          " duplicates.",
      );
    } else {
      SpreadsheetApp.getUi().alert(
        "No new customers found. All rows were duplicates.",
      );
    }
  }

  return {
    importMonthlyList: importMonthlyList,
  };
})();
