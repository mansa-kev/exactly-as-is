import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { Shield, Clock, Heart, Award, Target, Users, Sparkles, MapPin, Car, Headphones } from 'lucide-react';
import { usePublicImagesFinal } from '../../hooks/usePublicImagesFinal';

const values = [
  {
    icon: Shield,
    title: "Uncompromising Safety",
    description: "Every vehicle in our fleet undergoes rigorous multi-point inspections and regular maintenance to ensure your peace of mind."
  },
  {
    icon: Clock,
    title: "Seamless Experience",
    description: "From booking to drop-off, we've optimized every touchpoint to be fast, intuitive, and respectful of your time."
  },
  {
    icon: Heart,
    title: "Passion for Service",
    description: "We don't just rent cars; we provide the keys to your next adventure with a dedicated team available 24/7."
  },
  {
    icon: Award,
    title: "Premium Standards",
    description: "Our curated selection features only the latest models with top-tier specifications and pristine interiors."
  }
];

const whyLinkedUp = [
  {
    icon: Car,
    title: "Curated Fleet",
    description: "From economy to luxury, every car in our fleet is handpicked and maintained to the highest standards."
  },
  {
    icon: MapPin,
    title: "Flexible Pickup",
    description: "Pick up and drop off across Nairobi — CBD, Westlands, JKIA, and more locations for your convenience."
  },
  {
    icon: Headphones,
    title: "24/7 Support",
    description: "Our dedicated team is always available. Call, text, or message us anytime — day or night."
  },
  {
    icon: Sparkles,
    title: "No Hidden Fees",
    description: "Transparent pricing with insurance included. What you see is what you pay — no surprises at pickup."
  },
  {
    icon: Users,
    title: "Chauffeur Services",
    description: "Need a driver? Our vetted, professional chauffeurs are available for airport transfers or full-day hire."
  },
  {
    icon: Target,
    title: "Loyalty Rewards",
    description: "Earn points with every booking. Unlock exclusive discounts, free upgrades, and VIP perks as you drive more."
  }
];

export function AboutUs() {
  const { images, loading } = usePublicImagesFinal();

  // Fallback images if no custom images are uploaded
  const heroImage = images.about_hero_image || 'https://picsum.photos/seed/luxury-fleet/1920/800';
  const teamImage = images.about_team_image || 'https://picsum.photos/seed/team-linkedup/800/1000';
  const missionImage = images.about_mission_image || 'https://picsum.photos/seed/mission-linkedup/600/400';

  const showHeroImage = !loading && heroImage;
  const showTeamImage = !loading && teamImage;
  const showMissionImage = !loading && missionImage;

  return (
    <>
      <Helmet>
        <title>About Us | LinkedUp Cars Rentals Nairobi</title>
        <meta name="description" content="Learn about LinkedUp Cars Rentals — Nairobi's trusted car hire, chauffeur and corporate transport provider. Two offices: Lanphil Arcade Ridgeways and GoldenHeights Mirema." />
        <link rel="canonical" href="https://linkedupcarsrentals.com/about" />
        <meta property="og:title" content="About LinkedUp Cars Rentals | Nairobi" />
        <meta property="og:url" content="https://linkedupcarsrentals.com/about" />
      </Helmet>
    <div className="pt-32 pb-20">
      {/* Hero Section */}
      <section className="px-6 mb-32">
        <div className="max-w-7xl mx-auto text-center">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-primary text-xs font-black uppercase tracking-[0.3em] mb-6 block"
          >
            Our Story
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-8xl font-serif font-black tracking-tighter italic text-foreground leading-tight mb-12"
          >
            Redefining the <span className="text-primary">Art of Travel</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-3xl mx-auto font-medium leading-relaxed"
          >
            Founded on the principle that every journey deserves a touch of luxury, LinkedUp Car Rentals has grown from a boutique fleet to a premier automotive experience provider in Nairobi and beyond.
          </motion.p>
        </div>
      </section>

      {/* Image Section */}
      <section className="px-6 mb-32">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative aspect-[21/9] rounded-[60px] overflow-hidden border border-border"
          >
            {showHeroImage ? (
              <img
                src={heroImage}
                alt="Our Luxury Fleet"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground text-sm">
                    {loading ? 'Loading image...' : 'No image set'}
                  </p>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          </motion.div>
        </div>
      </section>

      {/* Core Values Grid */}
      <section className="px-6 mb-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-primary text-xs font-black uppercase tracking-[0.3em] mb-4 block">What Drives Us</span>
            <h2 className="text-3xl md:text-5xl font-serif font-black tracking-tighter italic text-foreground">Our Core Values</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-10 rounded-[40px] bg-card border border-border hover:border-primary/20 transition-all group"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                  <value.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-serif font-black tracking-tight italic mb-4 text-foreground">
                  {value.title}
                </h3>
                <p className="text-muted-foreground font-medium leading-relaxed">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why LinkedUp Section */}
      <section className="px-6 mb-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-primary text-xs font-black uppercase tracking-[0.3em] mb-4 block">The LinkedUp Advantage</span>
            <h2 className="text-3xl md:text-5xl font-serif font-black tracking-tighter italic text-foreground">
              Why Choose <span className="text-primary">LinkedUp</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyLinkedUp.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="p-8 rounded-[32px] bg-card/50 border border-border hover:bg-card/70 hover:border-primary/10 transition-all group flex gap-6"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team & Mission Section */}
      <section className="px-6 mb-32">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-primary text-xs font-black uppercase tracking-[0.3em] mb-4 block">Our Mission</span>
            <h2 className="text-3xl md:text-5xl font-serif font-black tracking-tighter italic text-foreground mb-8 leading-tight">
              More Than Cars. <span className="text-primary">We Deliver Freedom.</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-8">
              At LinkedUp, we believe mobility is more than getting from point A to B. It's about the confidence of driving a well-maintained vehicle, the convenience of flexible pickups, and the peace of mind that comes with genuine support.
            </p>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Whether you're a tourist exploring Nairobi, a business traveler needing reliable transport, or a local looking for a weekend upgrade — we've got you covered with a fleet that fits every need and budget.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative aspect-[4/5] rounded-[48px] overflow-hidden border border-border"
          >
            {showTeamImage ? (
              <>
                <img
                  src={teamImage}
                  alt="LinkedUp Team"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                <div className="absolute bottom-8 left-8 right-8">
                  <div className="p-6 glass rounded-[32px]">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2">Based In</p>
                    <p className="text-foreground font-bold text-lg">Nairobi, Kenya</p>
                    <p className="text-muted-foreground text-sm">Lanphil Arcade, Ridgeways, Kiambu Road</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground text-sm">
                    {loading ? 'Loading image...' : 'No image set'}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="px-6 py-32 bg-primary/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary rounded-full blur-[120px]" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-serif font-black tracking-tight italic text-foreground mb-12 leading-tight">
            "Our mission is to provide more than just a car; we provide the freedom to explore with confidence and style."
          </h2>
          <div className="flex items-center justify-center gap-4">
            <div className="w-12 h-[1px] bg-primary/40" />
            <span className="text-primary font-black uppercase tracking-widest text-xs">The LinkedUp Team</span>
            <div className="w-12 h-[1px] bg-primary/40" />
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
