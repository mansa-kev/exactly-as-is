/**
 * After a booking payment succeeds, queue supplier + broker payout settlements
 * and notify outsourced vehicle owners when applicable.
 */
export async function processBookingPayoutSettlements(supabase, bookingId, logPrefix = '[NCBA]') {
    try {
        const { data: bookingFull } = await supabase
            .from('bookings')
            .select('id, car_id, total_amount, metadata, fleet_owner_id')
            .eq('id', bookingId)
            .maybeSingle();
        if (!bookingFull)
            return;
        const meta = (bookingFull.metadata || {});
        const ownerPayout = Number(meta.owner_payout_amount) || 0;
        const outsource = meta.outsource_info || null;
        const broker = meta.broker_info || null;
        if (ownerPayout > 0 && bookingFull.car_id) {
            const { data: existingSupplierSettle } = await supabase
                .from('payout_settlements')
                .select('id')
                .eq('booking_id', bookingFull.id)
                .eq('type', 'supplier')
                .maybeSingle();
            if (!existingSupplierSettle) {
                await supabase.from('payout_settlements').insert({
                    booking_id: bookingFull.id,
                    type: 'supplier',
                    target_id: bookingFull.car_id,
                    amount: ownerPayout,
                    status: 'pending',
                }).then(null, (err) => console.error(`${logPrefix} Supplier settlement insert error:`, err));
            }
        }
        if (broker?.broker_id && Number(broker.broker_commission_amount) > 0) {
            const { data: existingBrokerSettle } = await supabase
                .from('payout_settlements')
                .select('id')
                .eq('booking_id', bookingFull.id)
                .eq('type', 'broker')
                .maybeSingle();
            if (!existingBrokerSettle) {
                await supabase.from('payout_settlements').insert({
                    booking_id: bookingFull.id,
                    type: 'broker',
                    target_id: broker.broker_id,
                    amount: Number(broker.broker_commission_amount),
                    status: 'pending',
                }).then(null, (err) => console.error(`${logPrefix} Broker settlement insert error:`, err));
            }
        }
        if (outsource?.is_outsourced && outsource?.owner_email) {
            const subject = 'New Booking Confirmed — Your Vehicle';
            const text = `Hello ${outsource.owner_name || 'Partner'},\n\nA new booking on your vehicle has just been paid.\n\nBooking: #${bookingFull.id.slice(0, 8).toUpperCase()}\nGross: KES ${Number(bookingFull.total_amount).toLocaleString()}\nCommission (${Math.round((meta.commission_rate_applied || 0) * 100)}%): KES ${(Number(bookingFull.total_amount) - ownerPayout).toLocaleString()}\nYour Payout: KES ${ownerPayout.toLocaleString()} (pending settlement)\n\n— LinkedUp Cars`;
            await supabase.functions.invoke('send-email', {
                body: {
                    to: outsource.owner_email,
                    subject,
                    text,
                    html: `<div style="font-family:sans-serif;line-height:1.6;white-space:pre-wrap">${text}</div>`,
                },
            }).then(null, (err) => console.error(`${logPrefix} Owner email error:`, err));
        }
    }
    catch (err) {
        console.error(`${logPrefix} Payout settlement processing error:`, err);
    }
}
