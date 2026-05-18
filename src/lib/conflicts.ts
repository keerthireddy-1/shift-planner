import { Assignment, ShiftTemplate, User } from "../types";
import { isBefore, isAfter, parse, addHours, format, parseISO } from "date-fns";

export interface Conflict {
  type: 'overlap' | 'overtime' | 'preference';
  message: string;
  severity: 'warning' | 'error';
}

export function detectConflicts(
  newAssignment: Omit<Assignment, 'id'>,
  existingAssignments: Assignment[],
  user: User,
  templates: ShiftTemplate[]
): Conflict[] {
  const conflicts: Conflict[] = [];
  const template = templates.find(t => t.id === newAssignment.shiftId);
  if (!template) return [];

  const startStr = `${newAssignment.date} ${template.startTime}`;
  const endStr = `${newAssignment.date} ${template.endTime}`;
  
  const start = parse(startStr, 'yyyy-MM-dd HH:mm', new Date());
  let end = parse(endStr, 'yyyy-MM-dd HH:mm', new Date());
  
  // Handle overnight
  if (isBefore(end, start)) {
    end = addHours(end, 24);
  }

  // 1. Overlap Check
  const userAssignments = existingAssignments.filter(a => a.userId === newAssignment.userId && a.date === newAssignment.date);
  for (const existing of userAssignments) {
    const extTemplate = templates.find(t => t.id === existing.shiftId);
    if (!extTemplate) continue;

    const extStart = parse(`${existing.date} ${extTemplate.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    let extEnd = parse(`${existing.date} ${extTemplate.endTime}`, 'yyyy-MM-dd HH:mm', new Date());
    if (isBefore(extEnd, extStart)) extEnd = addHours(extEnd, 24);

    // Overlap condition: (StartA < EndB) && (EndA > StartB)
    if (isBefore(start, extEnd) && isAfter(end, extStart)) {
      conflicts.push({
        type: 'overlap',
        message: `Overlaps with ${extTemplate.name} shift`,
        severity: 'error'
      });
    }
  }

  // 2. Weekly Hour Limit
  const weekAssignments = existingAssignments.filter(a => a.userId === newAssignment.userId); // Simplified
  // In real case, we'd filter by the specific week.
  const totalHours = weekAssignments.reduce((acc, a) => {
    const t = templates.find(tpl => tpl.id === a.shiftId);
    if (!t) return acc;
    // Calculate hours...
    return acc + 8; // Stub 8 hours for now
  }, 0);

  if (totalHours + 8 > user.maxWeeklyHours) {
    conflicts.push({
      type: 'overtime',
      message: `Exceeds weekly limit (${user.maxWeeklyHours}h)`,
      severity: 'warning'
    });
  }

  return conflicts;
}
