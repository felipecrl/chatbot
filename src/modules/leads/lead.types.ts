export interface CreateLeadInput {
  phoneNumber: string;
  name?: string | null;
  email?: string | null;
  propertyCode?: string | null;
  propertyDescription?: string | null;
  scheduledAt?: Date | null;
}

export interface ScheduleVisitInput {
  phoneNumber: string;
  name: string;
  email?: string | null;
  propertyCode: string;
  propertyDescription?: string | null;
  scheduledAt?: Date | null;
}

export interface ScheduleVisitResult {
  leadId: number;
  crmLeadId: string | null;
  crmAppointmentId: string | null;
}
