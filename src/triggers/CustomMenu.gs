function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🚗 TLB Admin")
    .addItem("Import Monthly Customers", "runCustomerImport")
    .addToUi();
}

function runCustomerImport() {
  try {
    CustomerService.importMonthlyList();
  } catch (e) {
    SpreadsheetApp.getUi().alert("Error: " + e.message);
  }
}
