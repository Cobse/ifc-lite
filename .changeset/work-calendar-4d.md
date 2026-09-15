---
"@ifc-lite/parser": minor
"@ifc-lite/create": minor
"@ifc-lite/sandbox": minor
"@ifc-lite/sdk": minor
---

Add IfcWorkCalendar / IfcWorkTime / IfcRecurrencePattern support to the 4D scheduling pipeline: calendars and their working / exception times are now extracted, round-tripped losslessly on export, and readable from `bim.schedule.data()`. `IfcCreator.addIfcWorkCalendar` (plus the `assignCalendarToTasks` alias) authors them, exposed through `bim.create.*`. Calendars are surfaced read-only — deriving working-day-aware task dates from a recurrence pattern is not implemented.
