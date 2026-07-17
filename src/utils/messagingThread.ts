export function normalizeSubject(subject?: string | null): string {
  return String(subject || '')
    .replace(/^re:\s*/i, '')
    .trim();
}

export function getMessageThreadKey(message: {
  booking_id?: string | null;
  subject?: string | null;
}): string {
  if (message.booking_id) return `booking:${message.booking_id}`;
  const subject = normalizeSubject(message.subject);
  return subject ? `subject:${subject.toLowerCase()}` : 'general';
}
