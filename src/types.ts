export interface VehicleModel {
  friendly_id?: number;
  id: string;
  slug?: string;
  family_slug?: string;
  family_name?: string;
  variant_name?: string;
  make: string;
  model: string;
  year?: number;
  display_name?: string;
  category?: string;
  description?: string;
  primary_image_url?: string;
  gallery_urls?: string[];
  video_url?: string;
  transmission?: string;
  fuel_type?: string;
  seats?: number;
  luggage?: number;
  features?: string[];
  base_daily_rate?: number;
  overtime_rate?: number;
  security_deposit?: number;
  is_chauffeured_only?: boolean;
  is_public?: boolean;
  booking_mode?: 'both' | 'reservation_only' | 'disabled';
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Car {
  id: string;
  vehicle_model_id?: string | null;
  make: string;
  model: string;
  year: number;
  color: string;
  license_plate: string;
  category: string;
  description: string;
  primary_image_url: string;
  photos: string[];
  video_url: string;
  transmission: string;
  fuel_type: string;
  seats: number;
  luggage?: number;
  features: string[];
  daily_rate: number;
  overtime_rate: number;
  security_deposit: number;
  status: 'available' | 'rented' | 'maintenance' | 'unavailable';
  maintenance_status: 'ok' | 'due' | 'in_progress';
  is_outsourced?: boolean;
  outsource_owner_name?: string;
  outsource_owner_phone?: string;
  outsource_owner_email?: string;
  outsource_commission_rate?: number;
  fleet_owner_id?: string;
  created_at: string;
  vehicle_model?: VehicleModel;
}

export interface Booking {
  id: string;
  vehicle_model_id?: string | null;
  client_id: string;
  car_id: string;
  fleet_owner_id: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'on_trip' | 'completed' | 'cancelled' | 'pending_payment_verification';
  total_amount: number;
  platform_commission: number;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_method?: 'mpesa' | 'cash' | 'ncba_stk';
  payment_provider?: 'mpesa' | 'cash' | 'ncba';
  pickup_location?: string;
  dropoff_location?: string;
  needs_chauffeur?: boolean;
  driver_id?: string;
  metadata?: any;
  created_at: string;
  cars?: Car;
  vehicle_model?: VehicleModel;
  client?: UserProfile;
  fleet_owner?: UserProfile;
  driver?: DriverProfile;
}

export interface CarReservation {
  id: string;
  car_id?: string | null;
  vehicle_model_id?: string | null;
  client_id?: string | null;
  fleet_owner_id?: string | null;
  start_date: string;
  end_date: string;
  reservation_fee: number;
  total_amount: number;
  status: 'reserved' | 'confirmed' | 'cancelled' | 'expired' | 'converted';
  payment_status: 'pending' | 'paid' | 'refunded' | 'failed';
  payment_method?: string | null;
  transaction_code?: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  notes?: string | null;
  expires_at?: string;
  created_at?: string;
  updated_at?: string;
  cars?: Car;
  vehicle_model?: VehicleModel;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  phone?: string;
  avatar_url?: string;
  role: 'admin' | 'fleet_owner' | 'client' | 'driver';
  license_number?: string;
  address?: string;
  status?: string;
  loyalty_tier?: string;
  created_at: string;
}

export interface DriverProfile {
  id: string;
  full_name?: string;
  email?: string;
  phone_number?: string;
  license_number?: string;
  license_expiry?: string;
  license_status?: string;
  id_status?: string;
  status: 'active' | 'suspended' | 'pending_verification';
  rating: number;
  total_trips: number;
  avatar_url?: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  link?: string;
  created_at: string;
}
