import React from 'react';
import { motion } from 'motion/react';

const sections = [
  {
    title: 'Rental Agreement',
    content:
      'By renting a vehicle from LinkedUp Car Rentals ("the Company"), you ("the Renter") agree to be bound by these Terms and Conditions. This agreement is governed by the laws of Kenya. The rental period begins at the time of vehicle collection and ends upon the return of the vehicle to the agreed location.',
  },
  {
    title: 'Eligibility',
    content:
      'Renters must be at least 23 years of age and hold a valid driver\'s license for a minimum of two years. A valid Kenyan national ID or passport is required for identity verification. International visitors must present a valid international driving permit. The Company reserves the right to decline any rental application at its discretion.',
  },
  {
    title: 'Booking & Payment',
    content:
      'Bookings can be made online or by contacting our team directly. A booking confirmation will be issued upon successful submission. Payment is accepted via M-Pesa (Paybill) or cash on pickup. Full payment or an agreed deposit is required before or at the time of vehicle collection. All prices are quoted in Kenyan Shillings and include VAT where applicable.',
  },
  {
    title: 'Insurance & Liability',
    content:
      'All rentals include basic comprehensive insurance coverage. The Renter is liable for the insurance excess amount in the event of damage or loss. Optional premium cover with a reduced excess is available at an additional daily charge. Insurance does not cover damage caused by negligence, driving under the influence of alcohol or drugs, or use of the vehicle outside the agreed terms.',
  },
  {
    title: 'Vehicle Use',
    content:
      'Vehicles must be used solely for lawful purposes. The Renter shall not sub-let, lend, or allow any unauthorised person to drive the vehicle. Off-road driving is strictly prohibited unless the vehicle is specifically classified for such use. The vehicle must remain within Kenya unless prior written consent is obtained from the Company.',
  },
  {
    title: 'Fuel Policy',
    content:
      'Vehicles are provided with a full tank of fuel and must be returned with a full tank. If the vehicle is returned with less fuel than provided, a refuelling charge at the prevailing market rate plus a service fee will be applied.',
  },
  {
    title: 'Late Returns',
    content:
      'The vehicle must be returned by the agreed date and time. Late returns without prior arrangement will incur a penalty charge equivalent to 150% of the daily rental rate for each additional day or part thereof. Failure to return the vehicle within 24 hours of the due date without communication may be treated as theft and reported to the authorities.',
  },
  {
    title: 'Damage & Penalties',
    content:
      'The Renter is responsible for inspecting the vehicle at pickup and reporting any pre-existing damage. Any damage occurring during the rental period that is not covered by insurance will be charged to the Renter. Traffic fines, toll charges, and parking penalties incurred during the rental period are the sole responsibility of the Renter.',
  },
  {
    title: 'Cancellation',
    content:
      'Cancellations made 48 or more hours before the scheduled pickup time are eligible for a full refund. Cancellations made within 48 hours of pickup are subject to a 20% cancellation fee. No-shows forfeit the full booking amount. The Company reserves the right to cancel any booking due to unforeseen circumstances, in which case a full refund will be issued.',
  },
];

export function Terms() {
  return (
    <div className="pt-32 pb-20">
      {/* Hero */}
      <section className="px-6 mb-20">
        <div className="max-w-7xl mx-auto text-center">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-primary text-xs font-black uppercase tracking-[0.3em] mb-6 block"
          >
            Legal
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-8xl font-serif font-black tracking-tighter italic text-foreground leading-tight mb-12"
          >
            Terms & <span className="text-primary">Conditions</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-3xl mx-auto font-medium leading-relaxed"
          >
            Please read these terms carefully before using our services. By booking a vehicle with LinkedUp Car Rentals you agree to the following conditions.
          </motion.p>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 mb-20">
        <div className="max-w-3xl mx-auto space-y-12">
          {sections.map((section, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
            >
              <h2 className="text-2xl font-serif font-black tracking-tight italic text-foreground mb-4">
                {index + 1}. {section.title}
              </h2>
              <p className="text-muted-foreground font-medium leading-relaxed">
                {section.content}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer note */}
      <section className="px-6">
        <div className="max-w-3xl mx-auto">
          <div className="p-10 rounded-[40px] bg-card border border-border text-center">
            <p className="text-muted-foreground font-medium leading-relaxed">
              These terms were last updated on <span className="text-foreground font-black">1 January 2026</span>. LinkedUp Car Rentals reserves the right to update these terms at any time. Continued use of our services constitutes acceptance of any changes.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
