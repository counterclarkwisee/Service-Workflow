/**
 * CustomerRepo.gs
 */
const CustomerRepo = (function () {
  const SHEET_NAME = "customer_master";

  function listAll() {
    return SheetsHelper.readAllAsObjects(SHEET_NAME);
  }

  return {
    listAll: listAll,
  };
})();
