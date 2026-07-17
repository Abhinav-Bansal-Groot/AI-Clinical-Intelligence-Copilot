type PatientNameParts = {
  first_name: string | null
  last_name: string | null
}

export function getPatientName(patient: PatientNameParts): string {
  return [patient.first_name, patient.last_name].filter(Boolean).join(' ').trim() || 'Unknown'
}
