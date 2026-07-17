import React from 'react';
import { motion } from 'motion/react';
import { Search, CalendarCheck, Car, Star, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const steps = [
  {
    number: '01',
    icon: Search,
    title: 'Browse & Choose',
    description: 'Search our fleet and pick your perfect ride. Filter by type, price, and features to find exactly what you need.',
  },
  {
    number: '02',
    icon: CalendarCheck,
    title: 'Book Online',
    description: 'Select your dates, preferred pickup location, and complete your booking in minutes with M-Pesa or cash on pickup.',
  },
  {
    number: '03',
    icon: Car,
    title: 'Pick Up & Drive',
    description: 'Collect your vehicle from the agreed location, complete a quick inspection, and hit the road with confidence.',
  },
  {
    number: '04',
    icon: Star,
    title: 'Return & Review',
    description: 'Drop off your vehicle at the designated point and share your experience to help other travellers.',
  },
];

export function HowItWorks() {
  return (
    <div className="pt-32 pb-20">
      {/* Hero */}
      <section className="px-6 mb-32">
        <div className="max-w-7xl mx-auto text-center">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-primary text-xs font-black uppercase tracking-[0.3em] mb-6 block"
          >
            Simple & Seamless
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-8xl font-serif font-black tracking-tighter italic text-white leading-tight mb-12"
          >
            How It <span className="text-primary">Works</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-3xl mx-auto font-medium leading-relaxed"
          >
            Getting behind the wheel of your ideal car is just four simple steps away. Here's how we make it effortless.
          </motion.p>
        </div>
      </section>

      {/* Steps — vertical on mobile, horizontal on desktop */}
      <section className="px-6 mb-32">
        <div className="max-w-7xl mx-auto">
          {/* Desktop horizontal */}
          <div className="hidden lg:grid lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="relative p-10 rounded-[40px] bg-card border border-white/5 hover:border-primary/20 transition-all group"
              >
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="absolute top-1/2 -right-4 w-8 h-[2px] bg-white/10 hidden lg:block" />
                )}

                <span className="text-primary/30 text-6xl font-serif font-black italic absolute top-6 right-8 select-none">
                  {step.number}
                </span>

                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                  <step.icon className="w-8 h-8 text-primary" />
                </div>

                <h3 className="text-2xl font-serif font-black tracking-tight italic mb-4 text-white">
                  {step.title}
                </h3>
                <p className="text-muted-foreground font-medium leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Mobile vertical timeline */}
          <div className="lg:hidden space-y-6">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-6"
              >
                {/* Timeline rail */}
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                    <span className="text-primary font-black text-sm">{step.number}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="w-[2px] flex-1 bg-white/10 mt-2" />
                  )}
                </div>

                {/* Content card */}
                <div className="pb-10 pt-1">
                  <div className="flex items-center gap-3 mb-3">
                    <step.icon className="w-5 h-5 text-primary" />
                    <h3 className="text-xl font-serif font-black tracking-tight italic text-white">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-muted-foreground font-medium leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-serif font-black tracking-tight italic text-white mb-8 leading-tight">
              Ready to <span className="text-primary">Get Started?</span>
            </h2>
            <Link
              to="/cars"
              className="inline-flex items-center gap-4 px-12 py-6 bg-primary rounded-2xl text-black font-black uppercase tracking-widest hover:bg-primary/90 transition-all group"
            >
              Browse Fleet Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
