import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus, Search, Phone, MessageCircle } from 'lucide-react';

interface FaqItem {
  category: string;
  question: string;
  answer: string;
}

type FaqCategory = 'all' | FaqItem['category'];

const FAQ_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'booking', label: 'Booking' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'payment', label: 'Payment' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'delivery', label: 'Delivery & Pickup' },
  { id: 'mileage', label: 'Mileage & Fuel' },
  { id: 'chauffeur', label: 'Chauffeur' },
  { id: 'condition', label: 'Car Condition' },
  { id: 'damage', label: 'Damage' },
  { id: 'crossborder', label: 'Cross-Border' },
  { id: 'myths', label: 'Myths Busted' },
];

const FAQS: FaqItem[] = [
  { category: 'booking', question: 'How do I book a car?', answer: 'Browse our fleet, select your dates and pickup location, complete the booking form, and pay via M-Pesa. You receive instant confirmation the moment your booking is submitted — no waiting.' },
  { category: 'booking', question: 'How far in advance should I book?', answer: 'For peak seasons (December, Easter, August) book 2–4 weeks ahead. For regular periods, same-day booking is possible subject to availability. Early booking guarantees your preferred vehicle.' },
  { category: 'booking', question: 'Can I modify my booking after confirmation?', answer: 'Yes — modify dates, pickup location, or vehicle up to 48 hours before pickup via your account dashboard or by calling us. Changes are subject to availability and rate differences.' },
  { category: 'booking', question: 'What is the cancellation policy?', answer: 'Full refund if cancelled 48+ hours before pickup. 50% refund if cancelled 24–48 hours before. No refund within 24 hours of pickup. Call us for genuine emergencies — we always try to be fair.' },
  { category: 'booking', question: 'Can I book as a guest without an account?', answer: 'Yes. However, an account gives you booking history, faster re-booking, exclusive discounts, and the ability to track your rental status in real time.' },
  { category: 'booking', question: 'How do I get my booking confirmation?', answer: 'Confirmation is sent instantly via SMS and email with your booking ID, vehicle details, and pickup instructions. Save it — you will need it at pickup.' },
  { category: 'booking', question: 'Can I extend my rental?', answer: 'Request an extension through your dashboard or by calling us before your return date. Extensions are billed at the current daily rate and subject to availability.' },
  { category: 'booking', question: 'Can I book multiple cars for an event?', answer: 'Yes — for weddings, corporate events, or group travel we offer fleet bookings with discounted rates. Contact us directly to arrange.' },
  { category: 'requirements', question: 'What documents do I need to rent?', answer: 'A valid driver\'s license, national ID or passport, and proof of residence. Corporate clients need a company letter of introduction. All documents are verified at pickup.' },
  { category: 'requirements', question: 'What is the minimum age to rent?', answer: '21 years for most vehicles. 25 years for luxury cars and large SUVs. Drivers under 25 may incur a young driver surcharge due to insurance requirements.' },
  { category: 'requirements', question: 'Can a foreigner rent a car in Kenya?', answer: 'Absolutely. International visitors rent with a valid passport and international driving permit (IDP). If you\'d rather not navigate Nairobi roads, our chauffeur service is an excellent alternative.' },
  { category: 'requirements', question: 'How long must I have held my license?', answer: 'At least 2 years. This is a firm insurance requirement. Provisional or learner licenses are not accepted.' },
  { category: 'requirements', question: 'Can I add an additional driver?', answer: 'Yes — at no extra cost. Every additional driver must present a valid ID and driver\'s license at pickup.' },
  { category: 'requirements', question: 'Are child seats available?', answer: 'Yes — KES 500/day. Specify at booking to guarantee availability for your pickup date.' },
  { category: 'payment', question: 'What payment methods do you accept?', answer: 'M-Pesa (Paybill), cash on pickup, and bank transfer for corporate clients. A credit card is NOT required — we are built for the Kenyan market.' },
  { category: 'payment', question: 'How much is the security deposit?', answer: 'KES 10,000 for economy, KES 20,000 for midsize, KES 30,000 for SUVs and luxury. Paid at pickup and refunded within 7–14 working days after return, provided there is no damage or violation.' },
  { category: 'payment', question: 'When is my deposit refunded?', answer: '7–14 working days via M-Pesa is standard. If the car is returned spotless with no violations, we process in 3–5 days. We do not hold deposits unnecessarily.' },
  { category: 'payment', question: 'Are there hidden fees?', answer: 'None. Everything is disclosed upfront: daily rate, optional insurance upgrade, delivery fee if applicable, and the deposit. What you see at booking is what you pay.' },
  { category: 'payment', question: 'Can I pay in installments?', answer: 'For rentals over 7 days — 50% upfront and 50% at the midpoint. Corporate clients can arrange monthly billing subject to credit approval.' },
  { category: 'insurance', question: 'What does basic insurance cover?', answer: 'Third-party liability, theft, and collision damage. Your deductible (excess) is KES 50,000 for standard vehicles and KES 100,000 for luxury/SUVs.' },
  { category: 'insurance', question: 'What is NOT covered by insurance?', answer: 'Undercarriage damage, tires, interior damage, lost keys, towing costs, and off-road damage. Premium insurance reduces these exclusions significantly.' },
  { category: 'insurance', question: 'Is roadside assistance included?', answer: '24/7 roadside assistance is included with every rental. Breakdown in Nairobi: we send help within 2 hours. Out of town: we coordinate with local partners.' },
  { category: 'insurance', question: 'What happens if I have an accident?', answer: 'Call us immediately on +254714764162. Do not admit fault. Take photos and exchange details. We guide you through the process and arrange a replacement vehicle where possible.' },
  { category: 'insurance', question: 'What is premium insurance and should I get it?', answer: 'Premium insurance (KES 1,500/day extra) reduces your excess to KES 10,000 and extends cover to tires, undercarriage, and interior. Recommended for longer trips and peace of mind.' },
  { category: 'insurance', question: 'Does insurance cover game drives in national parks?', answer: 'Basic insurance covers normal road driving. For game drives in parks, premium insurance is strongly recommended — park terrain adds risks that basic cover excludes.' },
  { category: 'delivery', question: 'Do you deliver to JKIA Airport?', answer: 'Yes — 24/7. Our driver meets you at arrivals with a name sign. JKIA delivery fee: KES 2,000.' },
  { category: 'delivery', question: 'Do you deliver to hotels?', answer: 'Yes — anywhere in Nairobi, Kiambu, Mirema, Ridgeways, Roysambu, and surrounding areas. Fee: KES 1,000–3,000 depending on distance.' },
  { category: 'delivery', question: 'What are delivery fees?', answer: 'JKIA: KES 2,000 | CBD/Westlands: KES 1,500 | Karen/Kilimani: KES 2,000 | Kiambu Road/Ridgeways: KES 1,000 | Mirema/Roysambu: KES 1,000 | Other areas: quoted on request.' },
  { category: 'delivery', question: 'Can I pick up at your office for free?', answer: 'Yes — free pickup at Lanphil Arcade, Ridgeways (main office) or GoldenHeights, Mirema (branch). Always the most economical option.' },
  { category: 'delivery', question: 'Can I return to a different location?', answer: 'Yes — one-way rentals are available for an additional fee based on distance between pickup and drop-off.' },
  { category: 'delivery', question: 'What if my flight is delayed?', answer: 'We monitor flights for airport pickups. No extra charge for delays up to 2 hours. Just keep us updated if delays run longer.' },
  { category: 'mileage', question: 'Is mileage unlimited?', answer: 'Standard rentals include 200km/day free. Extra mileage: KES 15/km (economy), KES 20/km (SUV/luxury). Unlimited mileage packages are available for longer or out-of-town trips.' },
  { category: 'mileage', question: 'What is the fuel policy?', answer: 'Full-to-full. You receive the car with a full tank and return it full. If returned with less, you are charged for the shortfall plus a service fee.' },
  { category: 'mileage', question: 'Who pays for fuel?', answer: 'You pay for all fuel used. Refuel at reputable stations (Shell, Total, Rubis) and keep receipts in case of any queries at return.' },
  { category: 'chauffeur', question: 'What is the chauffeur fee?', answer: 'KES 3,000/day within Nairobi, KES 4,000/day for out-of-town trips. Driver accommodation and meals are your responsibility for trips outside Nairobi.' },
  { category: 'chauffeur', question: 'Are chauffeurs vetted and licensed?', answer: 'Every chauffeur passes background checks, holds a valid PSV license, and is trained in defensive driving. They know Nairobi and popular destinations extremely well.' },
  { category: 'chauffeur', question: 'How many hours can a chauffeur work per day?', answer: '10 hours per day standard. Overtime is KES 300/hour. Multi-day trips include scheduled rest periods as required by law.' },
  { category: 'chauffeur', question: 'Is chauffeur better than self-drive?', answer: 'Self-drive gives maximum freedom. Chauffeur is better if you are unfamiliar with Nairobi, travelling for business, or want to relax or drink at events. For groups of 3+, a chauffeur is often cost-effective.' },
  { category: 'condition', question: 'How old are the cars in the fleet?', answer: 'Our fleet ranges from 1–4 years old. All vehicles undergo a 50-point inspection before every rental. We replace vehicles regularly to maintain reliability.' },
  { category: 'condition', question: 'What if the car breaks down?', answer: 'Call our 24/7 support line immediately. In Nairobi: mechanic or replacement within 2 hours. Out of town: we coordinate with local partners. You are never left stranded.' },
  { category: 'condition', question: 'Is the AC working in all cars?', answer: 'Yes — every vehicle has functioning air conditioning tested before rental. If AC fails during your trip, we replace the vehicle at no cost to you.' },
  { category: 'condition', question: 'Are cars professionally cleaned before rental?', answer: 'Every car is professionally cleaned inside and out before pickup. High-touch surfaces are sanitised. Extra deep cleaning available on request.' },
  { category: 'condition', question: 'Does the car have GPS?', answer: 'Most vehicles have built-in GPS. For those without, we provide a portable unit at no extra cost. Google Maps on your phone works perfectly too.' },
  { category: 'damage', question: 'What if I scratch the car?', answer: 'Minor scratches under 3cm are generally absorbed. Larger or multiple scratches may incur a repair fee up to your excess amount. We inspect the vehicle together at return — nothing is hidden.' },
  { category: 'damage', question: 'How is damage assessed?', answer: 'We do a joint walk-around inspection at pickup and at return using a checklist. Photos are taken both times. Any dispute is resolved openly using this evidence.' },
  { category: 'damage', question: 'What if I lose the car keys?', answer: 'Lost keys are NOT covered by basic insurance. Replacement cost: KES 10,000–20,000 depending on the vehicle. Keep your keys secure — we recommend using the key hook in the car.' },
  { category: 'damage', question: 'What if I get a flat tire?', answer: 'A spare tire and tools are in every vehicle. If you cannot change it, call roadside assistance. Tire damage is not covered by basic insurance — premium cover includes it.' },
  { category: 'crossborder', question: 'Can I drive to Tanzania or Uganda?', answer: 'Cross-border travel requires prior written permission from us, additional COMESA insurance, and relevant border documents. This service is available for select vehicles at an additional fee.' },
  { category: 'crossborder', question: 'What are cross-border fees?', answer: 'KES 5,000 per country for authorization plus COMESA insurance (approx. KES 3,000). You are responsible for visa fees and border charges. Plan well in advance.' },
  { category: 'crossborder', question: 'Which vehicles are allowed cross-border?', answer: 'Only 4WD SUVs (Land Cruiser, Prado, Pajero) are permitted. Small economy cars are not approved for cross-border use due to road conditions and reliability requirements.' },
  { category: 'myths', question: 'Myth: Insurance covers absolutely everything', answer: 'FALSE — insurance has clear exclusions: undercarriage, tires, interior damage, lost keys, and off-road damage. Premium cover reduces exclusions but nothing is 100% covered. Always read the policy.' },
  { category: 'myths', question: 'Myth: My deposit is refunded the same day', answer: 'FALSE — deposits take 7–14 working days to process. This is industry standard for damage verification and M-Pesa processing timelines.' },
  { category: 'myths', question: 'Myth: Unlimited mileage is always included', answer: 'FALSE — most standard rentals have a 200km/day limit. Unlimited mileage costs extra. Always check and factor this in for long road trips.' },
  { category: 'myths', question: 'Myth: All car damage is fully covered', answer: 'FALSE — you pay the excess (deductible) before insurance covers the rest. Your liability is KES 50,000–100,000 depending on the vehicle class.' },
  { category: 'myths', question: 'Myth: Online booking is more expensive', answer: 'FALSE — online bookings are frequently cheaper with exclusive digital discounts. You also compare vehicles easily and lock in rates instantly.' },
  { category: 'myths', question: 'Myth: A credit card is required to rent', answer: 'FALSE — we fully support M-Pesa and cash. Credit cards are NOT mandatory here unlike in many Western countries.' },
  { category: 'myths', question: 'Myth: Cancellation is always free', answer: 'FALSE — free cancellation only applies 48+ hours before pickup. Within 24 hours, no refund is given. Within 24–48 hours, a 50% fee applies.' },
  { category: 'myths', question: 'Myth: Chauffeur service is unaffordable', answer: 'FALSE — for groups of 3 or more, splitting the KES 3,000/day chauffeur fee is often cheaper than the stress of navigating unfamiliar Nairobi roads. Corporate clients find significant ROI.' },
  { category: 'myths', question: 'Myth: Cross-border driving is automatically allowed', answer: 'FALSE — cross-border travel requires explicit written permission, additional COMESA insurance, and is only approved for 4WD vehicles. Never assume it is included.' },
];

function FaqAccordionItem({ faq, index }: { faq: FaqItem; index: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const isMyth = faq.category === 'myths';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.03 }}
      className={`rounded-[20px] border overflow-hidden ${
        isMyth
          ? 'bg-error/5 border-error/20'
          : 'bg-card border-white/5 hover:border-primary/20'
      } transition-all`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-4 p-6 text-left group"
      >
        <div className="flex items-center gap-4 min-w-0">
          {isMyth && (
            <span className="shrink-0 text-xs font-black uppercase tracking-widest text-error bg-error/10 px-2 py-1 rounded-lg">
              Myth
            </span>
          )}
          <span className="text-base md:text-lg font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
            {faq.question}
          </span>
        </div>
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          {isOpen ? (
            <Minus className="w-4 h-4 text-primary" />
          ) : (
            <Plus className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6">
              <div className="h-px bg-border mb-4" />
              <p className="text-muted-foreground leading-relaxed">
                {faq.answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FAQ() {
  const [activeCategory, setActiveCategory] = useState<FaqCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo<FaqItem[]>(() => {
    return FAQS.filter((f) => {
      const matchesCat = activeCategory === 'all' || f.category === activeCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const schemaFaqs = FAQS.map((f) => ({
    '@type': 'Question',
    name: f.question,
    acceptedAnswer: { '@type': 'Answer', text: f.answer },
  }));

  return (
    <>
      <Helmet>
        <title>FAQ | Car Hire Questions Answered — LinkedUp Cars Nairobi</title>
        <meta
          name="description"
          content="Every question about renting a car in Nairobi answered — booking, insurance, payment, delivery, JKIA transfers, chauffeur, cross-border, damage and common myths busted."
        />
        <link rel="canonical" href="https://linkedupcarsrentals.com/faq" />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: schemaFaqs,
          })}
        </script>
      </Helmet>

      <div className="pt-32 pb-20">
        {/* Hero */}
        <section className="px-6 mb-16">
          <div className="max-w-4xl mx-auto text-center">
            <motion.span
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-primary text-xs font-black uppercase tracking-[0.3em] mb-4 block"
            >
              Everything Answered
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-serif font-black tracking-tighter italic text-foreground leading-tight mb-6"
            >
              Car Hire Questions,{' '}
              <span className="text-primary">No Fluff</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10"
            >
              Real answers to real questions — from payment and insurance to myths the
              industry doesn't want you to know.
            </motion.p>

            {/* Search */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative max-w-xl mx-auto"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input
                type="text"
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-card border border-border rounded-2xl text-base outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
              />
            </motion.div>
          </div>
        </section>

        {/* Category Pills */}
        <section className="px-6 mb-12">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-wrap gap-2 justify-center">
              {FAQ_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                    activeCategory === cat.id
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'bg-card border border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Results count */}
        <section className="px-6 mb-6">
          <div className="max-w-3xl mx-auto">
            <p className="text-sm text-muted-foreground">
              Showing <span className="text-foreground font-bold">{filtered.length}</span> question{filtered.length !== 1 ? 's' : ''}
              {searchQuery && (
                <> for <span className="text-primary font-bold">"{searchQuery}"</span></>
              )}
            </p>
          </div>
        </section>

        {/* FAQ Accordion */}
        <section className="px-6 mb-24">
          <div className="max-w-3xl mx-auto space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground text-lg">No questions found.</p>
                <button
                  onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
                  className="mt-4 text-primary font-bold text-sm hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filtered.map((faq, i) => (
                <React.Fragment key={`${faq.category}-${i}`}>
                  <FaqAccordionItem faq={faq} index={i} />
                </React.Fragment>
              ))
            )}
          </div>
        </section>

        {/* Still Have Questions CTA */}
        <section className="px-6">
          <div className="max-w-3xl mx-auto">
            <div className="relative p-10 md:p-16 rounded-[32px] bg-card border border-border overflow-hidden text-center">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-serif font-black italic text-foreground mb-3">
                  Still not answered?
                </h2>
                <p className="text-muted-foreground mb-8">
                  Our team is available 24/7. Talk to a human — not a chatbot.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href="tel:+254714764162"
                    className="flex items-center justify-center gap-3 px-8 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                  >
                    <Phone size={18} />
                    Call Us Now
                  </a>
                  <a
                    href="https://wa.me/254714764162"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 px-8 py-4 bg-card border border-border rounded-2xl font-bold hover:border-primary/30 transition-all"
                  >
                    <MessageCircle size={18} />
                    WhatsApp
                  </a>
                  <Link
                    to="/contact"
                    className="flex items-center justify-center gap-3 px-8 py-4 bg-card border border-border rounded-2xl font-bold hover:border-primary/30 transition-all"
                  >
                    Send a Message
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
