export const mockAdminStats = {
  totalRevenue: 125430,
  revenueTrendPercent: 12.5,
  netCommission: 18814,
  commissionTrendPercent: 15.2,
  churnRate: 2.1,
  activeBookings: 142,
  activeBookingsTrendPercent: 5.4,
  revenueTrend: [
    { name: 'Mon', gross: 4000, net: 600 },
    { name: 'Tue', gross: 3000, net: 450 },
    { name: 'Wed', gross: 5000, net: 750 },
    { name: 'Thu', gross: 4500, net: 675 },
    { name: 'Fri', gross: 6000, net: 900 },
    { name: 'Sat', gross: 8000, net: 1200 },
    { name: 'Sun', gross: 7500, net: 1125 },
  ],
  bookingStatusDistribution: [
    { name: 'Completed', value: 400, color: '#10B981' },
    { name: 'Active', value: 142, color: '#3B82F6' },
    { name: 'Pending', value: 58, color: '#F59E0B' },
    { name: 'Cancelled', value: 24, color: '#EF4444' },
  ],
  topCars: [
    { name: 'Toyota Camry', count: 45 },
    { name: 'Honda Civic', count: 38 },
    { name: 'Tesla Model 3', count: 32 },
    { name: 'Ford Mustang', count: 28 },
    { name: 'BMW 3 Series', count: 25 },
  ],
  totalCars: 350,
  maintenanceCars: 12,
  newClients: 1250,
  newFleetOwners: 45,
};

export const mockFleetStats = {
  totalRevenue: 45200,
  revenueTrendPercent: 8.5,
  activeBookings: 24,
  activeBookingsTrendPercent: 12.0,
  totalCars: 15,
  utilizationRate: 85,
  revenueTrend: [
    { name: 'Mon', revenue: 1200 },
    { name: 'Tue', revenue: 900 },
    { name: 'Wed', revenue: 1500 },
    { name: 'Thu', revenue: 1350 },
    { name: 'Fri', revenue: 1800 },
    { name: 'Sat', revenue: 2400 },
    { name: 'Sun', revenue: 2250 },
  ],
  bookingStatusDistribution: [
    { name: 'Completed', value: 120, color: '#10B981' },
    { name: 'Active', value: 24, color: '#3B82F6' },
    { name: 'Pending', value: 8, color: '#F59E0B' },
    { name: 'Cancelled', value: 3, color: '#EF4444' },
  ],
  upcomingBookings: [
    { id: '1', car: 'Tesla Model 3', client: 'John Doe', startDate: '2023-11-01', endDate: '2023-11-05', amount: 450, status: 'confirmed' },
    { id: '2', car: 'BMW 3 Series', client: 'Jane Smith', startDate: '2023-11-02', endDate: '2023-11-04', amount: 300, status: 'pending' },
  ],
  recentPayouts: [
    { id: '1', amount: 1250, date: '2023-10-28', status: 'completed' },
    { id: '2', amount: 850, date: '2023-10-21', status: 'completed' },
  ],
};

export const mockCars = [
  { id: '1', make: 'Tesla', model: 'Model 3', year: 2023, daily_rate: 120, status: 'available', category: 'Electric', license_plate: 'ABC-123' },
  { id: '2', make: 'BMW', model: '3 Series', year: 2022, daily_rate: 150, status: 'rented', category: 'Luxury', license_plate: 'XYZ-789' },
  { id: '3', make: 'Toyota', model: 'Camry', year: 2021, daily_rate: 60, status: 'maintenance', category: 'Economy', license_plate: 'DEF-456' },
];

export const mockBookings = [
  { id: '1', car_id: '1', client_id: '101', start_date: '2023-11-01', end_date: '2023-11-05', total_amount: 480, status: 'confirmed', cars: { make: 'Tesla', model: 'Model 3' } },
  { id: '2', car_id: '2', client_id: '102', start_date: '2023-11-02', end_date: '2023-11-04', total_amount: 300, status: 'pending', cars: { make: 'BMW', model: '3 Series' } },
];

export const mockUsers = [
  { id: '101', full_name: 'John Doe', email: 'john@example.com', role: 'client', status: 'active', created_at: '2023-01-15T00:00:00Z' },
  { id: '102', full_name: 'Jane Smith', email: 'jane@example.com', role: 'client', status: 'active', created_at: '2023-02-20T00:00:00Z' },
  { id: '201', full_name: 'Fleet Corp', email: 'fleet@example.com', role: 'fleet_owner', status: 'active', created_at: '2023-03-10T00:00:00Z' },
];

export const mockPendingPayments = [
  { id: 'p1', booking_id: 'b1', client_id: '101', amount: 480, transaction_code: 'QWE123RTY', status: 'submitted', submitted_at: new Date().toISOString(), client: { full_name: 'John Doe', email: 'john@example.com' }, bookings: { start_date: '2023-11-01', end_date: '2023-11-05', total_amount: 480 } },
  { id: 'p2', booking_id: 'b2', client_id: '102', amount: 300, transaction_code: 'ASD456FGH', status: 'submitted', submitted_at: new Date().toISOString(), client: { full_name: 'Jane Smith', email: 'jane@example.com' }, bookings: { start_date: '2023-11-02', end_date: '2023-11-04', total_amount: 300 } }
];

export const mockMessages = [
  { id: 'm1', sender_id: '101', subject: 'Inquiry about Tesla Model 3', content: 'Hi, is the Tesla Model 3 available for next weekend?', status: 'new', urgency: 'medium', created_at: new Date().toISOString(), sender: { full_name: 'John Doe' } },
  { id: 'm2', sender_id: '201', subject: 'Payment Issue', content: 'I have not received my payout for last week.', status: 'open', urgency: 'high', created_at: new Date(Date.now() - 86400000).toISOString(), sender: { full_name: 'Fleet Corp' } }
];

export const mockContracts = [
  { id: 'c1', title: 'Standard Rental Agreement', type: 'rental', status: 'active', created_at: new Date().toISOString() },
  { id: 'c2', title: 'Fleet Owner Terms', type: 'fleet', status: 'active', created_at: new Date().toISOString() }
];

export const mockVerifications = [
  { id: 'v1', user_id: '101', document_type: 'id_card', status: 'pending', submitted_at: new Date().toISOString(), users: { full_name: 'John Doe', email: 'john@example.com' } },
  { id: 'v2', user_id: '201', document_type: 'business_license', status: 'pending', submitted_at: new Date().toISOString(), users: { full_name: 'Fleet Corp', email: 'fleet@example.com' } }
];

export const mockDrivers = [
  { id: 'd1', full_name: 'Mike Johnson', license_number: 'DL123456', status: 'active', rating: 4.8 },
  { id: 'd2', full_name: 'Sarah Williams', license_number: 'DL789012', status: 'active', rating: 4.9 }
];

export const mockReviews = [
  { id: 'r1', booking_id: 'b1', rating: 5, comment: 'Great car, very clean!', created_at: new Date().toISOString(), reviewer: { full_name: 'John Doe' } },
  { id: 'r2', booking_id: 'b2', rating: 4, comment: 'Good service, but pickup was slightly delayed.', created_at: new Date().toISOString(), reviewer: { full_name: 'Jane Smith' } }
];

export const mockTransactions = [
  { id: 't1', amount: 480, type: 'payment', status: 'completed', created_at: new Date().toISOString(), description: 'Payment for booking b1' },
  { id: 't2', amount: 300, type: 'payment', status: 'completed', created_at: new Date().toISOString(), description: 'Payment for booking b2' }
];

export const mockExpenses = [
  { id: 'e1', amount: 50, category: 'maintenance', date: new Date().toISOString(), description: 'Oil change for Toyota Camry' },
  { id: 'e2', amount: 120, category: 'insurance', date: new Date().toISOString(), description: 'Monthly insurance premium' }
];

export const mockPayouts = [
  { id: 'po1', fleet_owner_id: '201', amount: 1250, status: 'completed', date: new Date().toISOString() },
  { id: 'po2', fleet_owner_id: '201', amount: 850, status: 'pending', date: new Date().toISOString() }
];

export const mockHeroContent = [
  { id: 'h1', title: 'Premium Car Rentals', subtitle: 'Experience luxury on the road.', image_url: 'https://images.unsplash.com/photo-1503376713282-411394334f59?auto=format&fit=crop&q=80', is_active: true }
];

export const mockCoupons = [
  { id: 'cp1', code: 'SUMMER20', discount_percent: 20, valid_until: new Date(Date.now() + 86400000 * 30).toISOString(), is_active: true },
  { id: 'cp2', code: 'WELCOME10', discount_percent: 10, valid_until: new Date(Date.now() + 86400000 * 60).toISOString(), is_active: true }
];

export const mockIncidents = [
  { id: 'i1', booking_id: 'b1', type: 'damage', description: 'Scratch on the left door.', status: 'reported', reported_at: new Date().toISOString() }
];

export const mockClientDocuments = [
  { id: 'cd1', client_id: '101', type: 'driving_license', url: 'https://example.com/doc1.pdf', uploaded_at: new Date().toISOString() }
];
