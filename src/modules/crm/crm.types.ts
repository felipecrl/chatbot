export interface CrmLeadInput {
  name?: string | null;
  phoneNumber: string;
  email?: string | null;
  propertyCode?: string | null;
  source?: string;
}

export interface CrmAppointmentInput {
  name?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  propertyCode?: string | null;
  scheduledAt?: Date | null;
}

export interface CrmResult {
  id: string | null;
}
