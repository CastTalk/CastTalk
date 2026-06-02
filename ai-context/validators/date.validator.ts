/**
 * Governed AI Architecture - Date Validator
 * Validates dates planned by the AI Action Planner.
 */
export const validateDatePlan = (plannedDateString: string): boolean => {
  const dateObj = new Date(plannedDateString);
  
  // Verify date parsing compiles to a real timestamp
  if (isNaN(dateObj.getTime())) {
    return false;
  }

  // Strict Policy Check: AI cannot schedule events in the past
  if (dateObj.getTime() < Date.now()) {
    return false;
  }

  return true;
};
