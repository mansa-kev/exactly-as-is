import { supabase } from '../lib/supabase';

type SupportMode = 'support' | 'callback';

interface SubmitSupportRequestInput {
  mode: SupportMode;
  name: string;
  phone: string;
  message: string;
  context: string;
  source?: string;
}

const WHATSAPP_NUMBER = '254714764162';

async function fanOutToAdminInbox(
  senderId: string | null,
  subject: string,
  content: string
) {
  try {
    if (!senderId) return;

    const { data: admins } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('role', 'admin');

    if (!admins?.length) return;

    const inboxRows = admins
      .filter((admin) => admin.id && admin.id !== senderId)
      .map((admin) => ({
        sender_id: senderId,
        receiver_id: admin.id,
        subject,
        content,
        status: 'new',
        urgency: 'medium',
      }));

    if (inboxRows.length > 0) {
      await supabase.from('messages').insert(inboxRows);
    }
  } catch (err) {
    console.warn('[supportRequestService] admin inbox fanout skipped:', err);
  }
}

export async function submitSupportRequest(input: SubmitSupportRequestInput) {
  const subjectPrefix = input.mode === 'callback' ? 'Callback Request' : 'Support Request';
  const subject = `${subjectPrefix}: ${input.context}`;
  const source = input.source ? `Source: ${input.source}\n` : '';
  const enrichedMessage = `${source}${input.message}`.trim();

  const { data: authData } = await supabase.auth.getUser();
  const senderId = authData?.user?.id || null;

  const { error } = await supabase.from('contact_messages').insert([
    {
      name: input.name,
      phone: input.phone,
      email: 'support-widget@linkedup.com',
      subject,
      message: enrichedMessage,
    },
  ]);
  if (error) throw error;

  await fanOutToAdminInbox(
    senderId,
    subject,
    `Name: ${input.name}\nPhone: ${input.phone}\n${enrichedMessage}`
  );

  const waText =
    input.mode === 'callback'
      ? `Hello LinkedUp Cars!\n\nI would like a callback.\nName: ${input.name}\nPhone: ${input.phone}\nContext: ${input.context}\n\n${input.message}`
      : `Hello LinkedUp Cars!\n\nMy name is ${input.name}.\nI need help regarding: ${input.context}.\n\n${input.message}`;

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waText)}`, '_blank');
}
