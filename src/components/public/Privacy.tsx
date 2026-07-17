import React from 'react';
import { motion } from 'motion/react';

const sections = [
  {
    title: 'Information We Collect',
    content:
      'We collect personal information that you provide when booking a vehicle, creating an account, or contacting our team. This includes your full name, email address, phone number, national ID or passport number, driver\'s license details, and payment information. We also collect device and usage data such as IP address, browser type, and pages visited when you use our website.',
  },
  {
    title: 'How We Use Your Information',
    content:
      'Your information is used to process bookings, verify your identity, communicate booking confirmations and updates, improve our services, and comply with legal obligations. We may also use your contact details to send promotional offers and service updates, which you can opt out of at any time.',
  },
  {
    title: 'Data Security',
    content:
      'We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, alteration, disclosure, or destruction. Payment information is processed through secure, encrypted channels. However, no method of transmission over the internet is completely secure, and we cannot guarantee absolute security.',
  },
  {
    title: 'Third-Party Services',
    content:
      'We may share your information with trusted third parties solely for the purpose of delivering our services. This includes payment processors (M-Pesa/Safaricom), insurance providers, and chauffeur service partners. We do not sell your personal information to third parties. All partners are required to handle your data in accordance with applicable data protection laws.',
  },
  {
    title: 'Cookies',
    content:
      'Our website uses cookies and similar technologies to enhance your browsing experience, remember your preferences, and analyse site traffic. You can manage your cookie preferences through your browser settings. Disabling cookies may affect the functionality of certain features on our website.',
  },
  {
    title: 'Your Rights',
    content:
      'Under the Kenya Data Protection Act, 2019, you have the right to access, correct, or delete your personal data held by us. You may also object to or restrict certain processing of your data. To exercise any of these rights, please contact our data protection team using the details below. We will respond to your request within 30 days.',
  },
  {
    title: 'Contact Us',
    content:
      'If you have any questions or concerns about this Privacy Policy or how we handle your data, please contact us at privacy@linkeduprentals.com or call us at +254 700 000 000. Our offices are located in Nairobi, Kenya.',
  },
];

export function Privacy() {
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
            Privacy <span className="text-primary">Policy</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-3xl mx-auto font-medium leading-relaxed"
          >
            Your privacy matters to us. This policy explains how LinkedUp Car Rentals collects, uses, and protects your personal information.
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
              This policy was last updated on <span className="text-foreground font-black">1 January 2026</span>. LinkedUp Car Rentals reserves the right to update this policy at any time. We encourage you to review this page periodically for any changes.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
