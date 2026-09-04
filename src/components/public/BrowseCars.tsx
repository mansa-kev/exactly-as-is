import React from 'react';
import { Helmet } from 'react-helmet-async';
import { CarShowroom } from './CarShowroom';

export function BrowseCars() {
  return (
    <div>
      <Helmet>
        <title>Browse Models | Car Hire Nairobi — LinkedUp Cars Rentals</title>
        <meta name="description" content="Browse our vehicle models in Nairobi — luxury sedans, SUVs, budget cars and vans available for self-drive, chauffeur, airport transfers and corporate hire. Book instantly online." />
        <link rel="canonical" href="https://linkedupcarsrentals.com/cars" />
        <meta property="og:title" content="Browse & Book Vehicle Models in Nairobi | LinkedUp Cars" />
        <meta property="og:url" content="https://linkedupcarsrentals.com/cars" />
        <meta property="og:description" content="Hire any vehicle model in our Nairobi fleet — luxury, SUV, budget, self-drive or chauffeur. Instant booking online." />
      </Helmet>
      <CarShowroom />
    </div>
  );
}
