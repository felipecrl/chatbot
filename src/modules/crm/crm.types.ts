export interface CrmLeadInput {
  name?: string | null;
  phoneNumber: string;
  email?: string | null;
  propertyCode?: string | null;
  source?: string;
}

export interface CrmAppointmentInput {
  crmLeadId: string;
  propertyCode?: string | null;
  scheduledAt?: Date | null;
  clientName?: string | null;
}

export interface CrmResult {
  id: string | null;
}
