import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Phone, MapPin, Send, Clock, ChevronDown, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { InternationalPhoneInput } from '../ui/InternationalPhoneInput';
import { toast } from 'sonner';

const contactInfo = [
  {
    icon: Mail,
    label: "Email Us",
    value: "info@linkedupcarsrentals.com",
    link: "mailto:info@linkedupcarsrentals.com"
  },
  {
    icon: Phone,
    label: "Call / WhatsApp",
    value: "+254 714 764 162",
    link: "https://wa.me/254714764162"
  },
  {
    icon: MapPin,
    label: "Visit Us",
    value: "Lanphil Arcade, Ridgeways, Kiambu Road, Nairobi",
    link: "https://maps.google.com/?q=Lanphil+Arcade+Ridgeways"
  }
];

const businessHours = [
  { day: 'Monday - Friday', hours: '8:00 AM - 6:00 PM' },
  { day: 'Saturday', hours: '9:00 AM - 4:00 PM' },
  { day: 'Sunday', hours: '10:00 AM - 2:00 PM' },
];

const faqs = [
  {
    q: 'How do I book a car?',
    a: 'Browse our fleet, select your preferred vehicle, choose dates and pickup location, then complete the booking. You can pay via M-Pesa or cash on pickup.'
  },
  {
    q: 'What documents do I need?',
    a: 'A valid driver\'s license, national ID or passport, and proof of residence. International visitors need an international driving permit.'
  },
  {
    q: 'Is insurance included?',
    a: 'Yes, all rentals include basic comprehensive insurance. Additional coverage options are available at checkout.'
  },
  {
    q: 'Can I cancel my booking?',
    a: 'Cancellations 48+ hours before pickup receive a full refund. Within 48 hours, a 20% cancellation fee applies.'
  },
  {
    q: 'Do you deliver vehicles?',
    a: 'Yes! We offer pickup and delivery within Nairobi and surrounding areas including JKIA, Westlands, and CBD.'
  },
];

export function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    subject: 'General Inquiry',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.message) {
      toast.error('Please fill in your name and message');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase
        .from('contact_messages')
        .insert([{
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
        }]);

      if (error) throw error;
      setSent(true);
      toast.success('Message sent! We\'ll get back to you soon.');
      setFormData({ name: '', phone: '', email: '', subject: 'General Inquiry', message: '' });
      setTimeout(() => setSent(false), 5000);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pt-32 pb-20">
      <Helmet>
        <title>Contact Us | LinkedUp Cars Rentals Nairobi</title>
        <meta name="description" content="Contact LinkedUp Cars Rentals in Nairobi. Call +254714764162. Main office: Lanphil Arcade, Ridgeways, Kiambu Road. Branch: GoldenHeights, Mirema, Roysambu." />
        <link rel="canonical" href="https://linkedupcarsrentals.com/contact" />
        <meta property="og:title" content="Contact LinkedUp Cars | Nairobi Car Hire" />
        <meta property="og:url" content="https://linkedupcarsrentals.com/contact" />
      </Helmet>
      <section className="px-6 mb-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
            {/* Contact Information */}
            <div>
              <motion.span
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-primary text-xs font-black uppercase tracking-[0.3em] mb-6 block"
              >
                Get in Touch
              </motion.span>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-5xl md:text-8xl font-serif font-black tracking-tighter italic text-white leading-tight mb-12"
              >
                Let's Start Your <span className="text-primary">Next Journey</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl text-muted-foreground font-medium leading-relaxed mb-16"
              >
                Have a question about our fleet or need assistance with a booking? Our dedicated team is here to help you.
              </motion.p>

              <div className="space-y-12">
                {contactInfo.map((item, index) => (
                  <motion.a
                    key={index}
                    href={item.link}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="flex items-center gap-8 group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-card border border-white/5 flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/20 transition-all">
                      <item.icon className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <span className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1 block">
                        {item.label}
                      </span>
                      <span className="text-lg md:text-xl font-serif font-black tracking-tight italic text-white group-hover:text-primary transition-colors">
                        {item.value}
                      </span>
                    </div>
                  </motion.a>
                ))}
              </div>

              {/* Business Hours */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mt-16 p-8 rounded-[32px] bg-card border border-white/5"
              >
                <div className="flex items-center gap-3 mb-6">
                  <Clock className="text-primary" size={20} />
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Business Hours</h3>
                </div>
                <div className="space-y-3">
                  {businessHours.map((item, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground font-medium">{item.day}</span>
                      <span className="text-sm font-bold text-white">{item.hours}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="p-10 md:p-12 rounded-[60px] bg-card border border-white/5 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />

              {sent ? (
                <div className="relative z-10 flex flex-col items-center justify-center py-20 text-center">
                  <CheckCircle2 className="text-primary mb-6" size={64} />
                  <h3 className="text-2xl font-serif font-black italic text-white mb-4">Message Sent!</h3>
                  <p className="text-muted-foreground">We'll get back to you as soon as possible.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-4">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                      className="w-full px-8 py-5 rounded-2xl bg-background border border-white/10 focus:border-primary/40 focus:outline-none transition-all text-white font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-4">Phone Number *</label>
                      <InternationalPhoneInput
                        required
                        value={formData.phone}
                        onChange={(val) => setFormData({ ...formData, phone: val })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-4">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="john@example.com"
                        className="w-full px-8 py-5 rounded-2xl bg-background border border-white/10 focus:border-primary/40 focus:outline-none transition-all text-white font-medium"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-4">Issue / Subject</label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-8 py-5 rounded-2xl bg-background border border-white/10 focus:border-primary/40 focus:outline-none transition-all text-white font-medium appearance-none"
                    >
                      <option>General Inquiry</option>
                      <option>Booking Assistance</option>
                      <option>Fleet Partnership</option>
                      <option>Payment Issue</option>
                      <option>Feedback</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-4">Message *</label>
                    <textarea
                      rows={5}
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Describe your issue or question..."
                      className="w-full px-8 py-5 rounded-2xl bg-background border border-white/10 focus:border-primary/40 focus:outline-none transition-all text-white font-medium resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full py-6 bg-primary rounded-2xl text-black font-black uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-primary/90 transition-all group disabled:opacity-50"
                  >
                    {sending ? (
                      <><Loader2 className="animate-spin" size={20} /> Sending...</>
                    ) : (
                      <>Send Message <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /></>
                    )}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Google Maps Section */}
      <section className="px-6 mb-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-primary text-xs font-black uppercase tracking-[0.3em] mb-3 block">Find Us</span>
            <h2 className="text-2xl md:text-4xl font-serif font-black tracking-tighter italic text-white">
              Lanphil Arcade, Ridgeways
            </h2>
            <p className="text-muted-foreground mt-2">Kiambu Road, Nairobi, Kenya</p>
          </div>
          <div className="h-[400px] md:h-[500px] rounded-[40px] md:rounded-[60px] overflow-hidden border border-white/5 relative bg-muted">
            <iframe
              src="https://www.openstreetmap.org/export/embed.html?bbox=36.839%2C-1.218%2C36.859%2C-1.198&amp;layer=mapnik&amp;marker=-1.208%2C36.849"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="LinkedUp Cars - Lanphil Arcade, Ridgeways"
            />
            {/* Small credit to OpenStreetMap as required by their license */}
            <div className="absolute bottom-2 right-4 text-[10px] bg-background/80 backdrop-blur-md px-2 py-1 rounded border border-border/50 text-muted-foreground z-10">
              <a href="https://www.openstreetmap.org/?mlat=-1.208&amp;mlon=36.849#map=15/-1.2080/36.8490" target="_blank" rel="noreferrer" className="hover:text-primary">
                View Larger Map
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-primary text-xs font-black uppercase tracking-[0.3em] mb-3 block">Common Questions</span>
            <h2 className="text-2xl md:text-4xl font-serif font-black tracking-tighter italic text-white">
              Frequently Asked <span className="text-primary">Questions</span>
            </h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="rounded-2xl bg-card border border-white/5 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="text-sm font-bold text-white pr-4">{faq.q}</span>
                  <ChevronDown
                    size={18}
                    className={`text-primary shrink-0 transition-transform ${openFaq === index ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence>
                  {openFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-6 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
