const { z } = require('zod');

const hour   = z.number().int().min(0).max(23);
const minute = z.number().int().min(0).max(59);

const updateDutyTimingSettingsSchema = z.object({
  session_start_morning_hour:    hour.optional(),
  session_start_morning_min:     minute.optional(),
  session_start_afternoon_hour:  hour.optional(),
  session_start_afternoon_min:   minute.optional(),
  late_threshold_morning_hour:   hour.optional(),
  late_threshold_morning_min:    minute.optional(),
  late_threshold_afternoon_hour: hour.optional(),
  late_threshold_afternoon_min:  minute.optional(),
  auto_checkout_morning_hour:    hour.optional(),
  auto_checkout_morning_min:     minute.optional(),
  auto_checkout_afternoon_hour:  hour.optional(),
  auto_checkout_afternoon_min:   minute.optional(),
}).strict();

module.exports = { updateDutyTimingSettingsSchema };
