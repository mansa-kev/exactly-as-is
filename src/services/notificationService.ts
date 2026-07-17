import { supabase } from '../lib/supabase';

export type NotificationType =
  | 'booking_confirmation'
  | 'booking_approved'
  | 'return_reminder'
  | 'extension_prompt'
  | 'marketing'
  | 'welcome'
  | 'payment_receipt'
  | 'trip_started'
  | 'review_request';

export type ExternalChannel = 'sms' | 'email' | 'both';

/**
 * Central notification service for LinkedUp Cars.
 *
 * In-app notifications are written directly to the `notifications` table.
 * SMS / email messages are queued in `notification_queue` so that a
 * background worker (or edge function) can process them once an
 * external provider (Africa's Talking, Twilio, Resend, SendGrid, etc.)
 * is wired up.
 */
export const notificationService = {
  // ---------------------------------------------------------------------------
  // Public methods
  // ---------------------------------------------------------------------------

  /**
   * Sent immediately after successful payment.
   */
  async sendBookingConfirmation(booking: any): Promise<void> {
    const title = 'Booking Confirmed';
    const content = [
      `Your booking #${booking.id} has been confirmed!`,
      `Car: ${booking.car_name || booking.car_id}`,
      `Dates: ${booking.start_date} – ${booking.end_date}`,
      `Total: KES ${Number(booking.total_amount).toLocaleString()}`,
      'You will receive further details before your pickup date.',
    ].join('\n');

    await this._createNotification(
      booking.client_id,
      title,
      content,
      'booking_confirmation',
      `/bookings/${booking.id}`,
    );

    await this._queueExternalMessage(booking.client_id, 'both', 'booking_confirmation', {
      booking_id: String(booking.id),
      car_name: booking.car_name || booking.car_id,
      start_date: booking.start_date,
      end_date: booking.end_date,
      total_amount: String(booking.total_amount),
    });
  },

  /**
   * Sent when an admin or fleet owner approves / confirms the booking.
   */
  async sendBookingApproved(booking: any): Promise<void> {
    const title = 'Booking Approved';
    const content = [
      `Great news! Your booking #${booking.id} has been approved.`,
      `Car: ${booking.car_name || booking.car_id}`,
      `Pickup: ${booking.pickup_location || 'See booking details'}`,
      `Dates: ${booking.start_date} – ${booking.end_date}`,
    ].join('\n');

    await this._createNotification(
      booking.client_id,
      title,
      content,
      'booking_approved',
      `/bookings/${booking.id}`,
    );

    await this._queueExternalMessage(booking.client_id, 'both', 'booking_approved', {
      booking_id: String(booking.id),
      car_name: booking.car_name || booking.car_id,
      start_date: booking.start_date,
      end_date: booking.end_date,
      pickup_location: booking.pickup_location || 'See booking details',
    });
  },

  /**
   * Sent 24 hours before the booking end date.
   * Reminds the user about the upcoming return and offers an extension option.
   */
  async sendReturnReminder(booking: any): Promise<void> {
    const title = 'Return Reminder – 24 Hours Left';
    const content = [
      `Your booking #${booking.id} ends tomorrow (${booking.end_date}).`,
      'Please ensure the car is returned on time to avoid late fees.',
      'Need more time? You can extend your booking from the app.',
    ].join('\n');

    await this._createNotification(
      booking.client_id,
      title,
      content,
      'return_reminder',
      `/bookings/${booking.id}/extend`,
    );

    await this._queueExternalMessage(booking.client_id, 'both', 'return_reminder', {
      booking_id: String(booking.id),
      end_date: booking.end_date,
      car_name: booking.car_name || booking.car_id,
    });
  },

  /**
   * Sent 4 hours before the booking end date as a final extension prompt.
   */
  async sendExtensionPrompt(booking: any): Promise<void> {
    const title = 'Last Chance to Extend';
    const content = [
      `Your booking #${booking.id} ends in about 4 hours (${booking.end_date}).`,
      'Extend now to keep driving without interruption.',
    ].join('\n');

    await this._createNotification(
      booking.client_id,
      title,
      content,
      'extension_prompt',
      `/bookings/${booking.id}/extend`,
    );

    await this._queueExternalMessage(booking.client_id, 'sms', 'extension_prompt', {
      booking_id: String(booking.id),
      end_date: booking.end_date,
      car_name: booking.car_name || booking.car_id,
    });
  },

  /**
   * Send a bulk promotional / marketing message to a list of users.
   */
  async sendMarketingMessage(userIds: string[], offer: any): Promise<void> {
    const title = offer.title || 'Special Offer from LinkedUp Cars';
    const content = offer.body || offer.description || '';

    const promises = userIds.map(async (userId) => {
      await this._createNotification(userId, title, content, 'marketing', offer.link || '/offers');

      await this._queueExternalMessage(userId, 'both', 'marketing', {
        offer_title: title,
        offer_body: content,
        offer_code: offer.code || '',
        offer_link: offer.link || '',
      });
    });

    await Promise.all(promises);
  },

  /**
   * Sent on first sign-up.
   */
  async sendWelcomeMessage(userId: string, name: string): Promise<void> {
    const title = 'Welcome to LinkedUp Cars!';
    const content = [
      `Hi ${name}, welcome aboard!`,
      'Browse our fleet, book a car, and hit the road in minutes.',
      'Need help? Our support team is just a tap away.',
    ].join('\n');

    await this._createNotification(userId, title, content, 'welcome', '/cars');

    await this._queueExternalMessage(userId, 'both', 'welcome', {
      name,
    });
  },

  /**
   * Sent after a successful payment transaction.
   */
  async sendPaymentReceipt(booking: any): Promise<void> {
    const title = 'Payment Received';
    const content = [
      `We have received your payment of KES ${Number(booking.total_amount).toLocaleString()} for booking #${booking.id}.`,
      `Payment method: ${booking.payment_method || 'N/A'}`,
      'A receipt has been saved to your account.',
    ].join('\n');

    await this._createNotification(
      booking.client_id,
      title,
      content,
      'payment_receipt',
      `/bookings/${booking.id}`,
    );

    await this._queueExternalMessage(booking.client_id, 'both', 'payment_receipt', {
      booking_id: String(booking.id),
      total_amount: String(booking.total_amount),
      payment_method: booking.payment_method || 'N/A',
    });
  },

  /**
   * Sent when the car has been picked up and the trip officially begins.
   */
  async sendTripStarted(booking: any): Promise<void> {
    const title = 'Your Trip Has Started';
    const content = [
      `You are now on the road with booking #${booking.id}.`,
      `Car: ${booking.car_name || booking.car_id}`,
      `Return by: ${booking.end_date}`,
      'Drive safe and enjoy!',
    ].join('\n');

    await this._createNotification(
      booking.client_id,
      title,
      content,
      'trip_started',
      `/bookings/${booking.id}`,
    );

    await this._queueExternalMessage(booking.client_id, 'sms', 'booking_confirmation', {
      booking_id: String(booking.id),
      car_name: booking.car_name || booking.car_id,
      end_date: booking.end_date,
    });
  },

  /**
   * Sent after the trip has been completed, requesting a review.
   */
  async sendReviewRequest(booking: any): Promise<void> {
    const title = 'How Was Your Trip?';
    const content = [
      `Your booking #${booking.id} is complete.`,
      'We would love to hear about your experience! Leave a review to help fellow drivers.',
    ].join('\n');

    await this._createNotification(
      booking.client_id,
      title,
      content,
      'review_request',
      `/bookings/${booking.id}/review`,
    );

    await this._queueExternalMessage(booking.client_id, 'email', 'booking_confirmation', {
      booking_id: String(booking.id),
      car_name: booking.car_name || booking.car_id,
    });
  },

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Insert a row into the `notifications` table for in-app display.
   */
  async _createNotification(
    userId: string,
    title: string,
    content: string,
    type: NotificationType,
    link?: string,
  ): Promise<void> {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      content,
      type,
      link: link || null,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`[notificationService] Failed to create in-app notification (${type}):`, error.message);
    }
  },

  /**
   * Queue an external message (SMS / email / both) in the `notification_queue`
   * table. A background worker or edge function picks these up and dispatches
   * them via the configured provider.
   */
  async _queueExternalMessage(
    userId: string,
    channel: ExternalChannel,
    template: string,
    data: Record<string, string>,
  ): Promise<void> {
    const channels: Array<'sms' | 'email'> =
      channel === 'both' ? ['sms', 'email'] : [channel];

    const rows = channels.map((ch) => ({
      user_id: userId,
      channel: ch,
      template,
      data,
      status: 'pending',
      attempts: 0,
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('notification_queue').insert(rows);

    if (error) {
      console.error(
        `[notificationService] Failed to queue external message (${template}, ${channel}):`,
        error.message,
      );
    }
  },
};
