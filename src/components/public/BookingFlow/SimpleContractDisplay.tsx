import React from 'react';
import { resolveContractVehicle } from '../../../utils/contractTemplate';

interface SimpleContractDisplayProps {
  contract: any;
  bookingData: any;
  car: any;
  vehicleModelId?: string | null;
}

export function SimpleContractDisplay({ contract, bookingData, car, vehicleModelId }: SimpleContractDisplayProps) {
  if (!contract) {
    return (
      <div className="p-8 bg-yellow-100 border border-yellow-300 rounded-lg text-center">
        <h3 className="text-lg font-bold text-yellow-800 mb-2">No Contract Available</h3>
        <p className="text-yellow-700">Please upload a contract template in the admin panel.</p>
      </div>
    );
  }

  const vehicle = resolveContractVehicle(car, vehicleModelId);

  return (
    <div className="bg-card border-2 border-border rounded-lg p-8">
      <h1 className="text-2xl font-bold text-center mb-6">
        {contract.contract_title || 'Rental Agreement'}
      </h1>
      
      <div className="space-y-4 text-sm">
        <div className="border-b pb-4">
          <h2 className="font-bold text-lg mb-2">Contract Details</h2>
          <p><strong>Version:</strong> {contract.version}</p>
          <p><strong>Status:</strong> {contract.is_active ? 'Active' : 'Inactive'}</p>
        </div>

        <div className="border-b pb-4">
          <h2 className="font-bold text-lg mb-2">Rental Information</h2>
          <p><strong>Client:</strong> {bookingData?.firstName || 'N/A'} {bookingData?.lastName || 'N/A'}</p>
          <p><strong>Vehicle:</strong> {vehicle.displayName}</p>
          <p><strong>Registration:</strong> {vehicle.licensePlate}</p>
          <p><strong>Rental Period:</strong> {bookingData?.startDate || 'N/A'} to {bookingData?.endDate || 'N/A'}</p>
          <p><strong>Total Cost:</strong> KES {bookingData?.totalCost?.toLocaleString() || '0'}</p>
        </div>

        <div className="border-b pb-4">
          <h2 className="font-bold text-lg mb-2">Terms & Conditions</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>The renter agrees to return the vehicle in the same condition</li>
            <li>The renter is responsible for any damage during rental period</li>
            <li>Insurance coverage is mandatory for all rentals</li>
            <li>Late returns will incur additional charges</li>
          </ol>
        </div>

        <div className="border-b pb-4">
          <h2 className="font-bold text-lg mb-2">Payment Terms</h2>
          <p><strong>Daily Rate:</strong> KES {vehicle.dailyRate.toLocaleString()}</p>
          <p><strong>Security Deposit:</strong> KES {vehicle.securityDeposit.toLocaleString()}</p>
          <p><strong>Payment Method:</strong> {bookingData?.paymentMethod || 'Not specified'}</p>
        </div>

        <div className="text-center pt-4">
          <div className="border-t-2 border-gray-400 pt-4">
            <p className="font-bold mb-4">Signature Required</p>
            <div className="border-2 border-dashed border-gray-400 h-20 mb-2 flex items-center justify-center text-gray-500">
              [Digital Signature Area]
            </div>
            <p className="text-xs text-gray-600">
              By signing this agreement, you accept all terms and conditions
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 text-center">
        <p className="text-xs text-gray-500">
          Contract ID: {contract.id} | Generated: {new Date().toLocaleString()}
        </p>
      </div>
    </div>
  );
}
