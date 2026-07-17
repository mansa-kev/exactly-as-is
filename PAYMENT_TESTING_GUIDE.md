# Payment Flow Testing Guide

## Overview
This guide will help you test the complete booking and payment flow to identify any broken behaviors after payment completion and admin approval.

## Testing Checklist

### Phase 1: Booking Flow Testing

#### 1.1 Start the Booking
- [ ] Open the website on your phone
- [ ] Browse cars and select one
- [ ] Click "Reserve This Vehicle"
- [ ] Complete **Step 1**: Date selection
- [ ] Complete **Step 2**: Personal details (use test info)
- [ ] Complete **Step 3**: Review and sign contract
- [ ] Complete **Step 4**: Payment information

#### 1.2 Payment Testing
- [ ] Enter your phone number (M-Pesa registered)
- [ ] Click "Send STK Push"
- [ ] Complete the M-Pesa payment on your phone
- [ ] **Screenshot the payment confirmation page**
- [ ] Note the booking ID displayed

#### 1.3 Confirmation Page Testing
- [ ] **Check the status**: Should show "Awaiting Payment Verification"
- [ ] **Look for real-time updates**: Page should auto-update when payment is verified
- [ ] **Test the refresh button**: Click "Refresh Status" if available
- [ ] **Check for errors**: Look for any console errors or broken UI elements
- [ ] **Verify booking details**: Make sure all information is displayed correctly

### Phase 2: Admin Portal Testing

#### 2.1 Access Admin Portal
- [ ] Open admin portal on desktop
- [ ] Login with admin credentials
- [ ] Navigate to "Pending Payments" section

#### 2.2 Find and Approve Payment
- [ ] Locate your test booking by booking ID
- [ ] Verify the payment details (amount, phone number)
- [ ] Click "Verify" to approve the payment
- [ ] **Screenshot the admin interface** after approval

#### 2.3 Check Confirmation Updates
- [ ] **Switch back to phone** (or have someone watch)
- [ ] **Verify real-time update**: Confirmation page should update automatically
- [ ] **Check status change**: Should now show "Booking Confirmed!"
- [ ] **Look for success notification**: Should see "Payment confirmed!" toast
- [ ] **Test contract download**: Download button should now be enabled

### Phase 3: Edge Case Testing

#### 3.1 Failed Payment Testing
- [ ] Start a new booking
- [ ] Enter an invalid phone number or cancel M-Pesa payment
- [ ] **Check if status shows "Payment Failed"**
- [ ] **Test the "Try Again" button**
- [ ] **Verify error handling**: Should show appropriate error message

#### 3.2 Connection Issues Testing
- [ ] Test with poor internet connection
- [ ] **Check if retry logic works** (should attempt to reconnect)
- [ ] **Verify manual refresh still works**
- [ ] **Test if page loads correctly after connection restored**

## What to Look For (Potential Issues)

### 1. Real-time Update Issues
- **Symptom**: Page doesn't update after admin approval
- **Check**: Browser console for connection errors
- **Expected**: Should see "Realtime subscription established" message

### 2. Status Display Issues
- **Symptom**: Wrong status displayed or status doesn't change
- **Check**: Status logic in booking object
- **Expected**: Status should change from "pending" to "confirmed"

### 3. UI/UX Issues
- **Symptom**: Broken layouts, missing elements, wrong colors
- **Check**: All components render correctly in dark mode
- **Expected**: Clean, professional appearance

### 4. Notification Issues
- **Symptom**: No success/error notifications
- **Check**: Toast notifications appear correctly
- **Expected**: Clear feedback for all actions

### 5. Navigation Issues
- **Symptom**: Buttons don't work or navigate to wrong pages
- **Check**: All links and buttons function correctly
- **Expected**: Smooth navigation between pages

## Debug Information

### Console Logs to Check
Open browser console and look for:
- `Booking update received:` - Shows real-time updates working
- `Realtime subscription established` - Shows connection successful
- `Realtime connection error, retrying...` - Shows retry logic
- `Payment verification completed successfully` - Shows admin approval worked

### Network Requests to Check
- **WebSocket connection**: Should see `wss://` connection to Supabase
- **API calls**: Should see booking fetch calls
- **No failed requests**: All network requests should succeed

### Database State to Check
If you have access to Supabase dashboard:
- **bookings table**: Check status and payment_status fields
- **pending_payments table**: Check status field
- **transactions table**: Should have new entry after approval

## Test Data Suggestions

### Safe Test Information
- **Name**: Test User
- **Email**: test@example.com
- **Phone**: Your actual M-Pesa number (for real testing)
- **License**: TEST123456
- **Amount**: KES 1 (minimum test amount)

### Booking IDs to Track
Note down the booking ID for each test:
- Test 1: [Booking ID] - [Result]
- Test 2: [Booking ID] - [Result]
- Test 3: [Booking ID] - [Result]

## Reporting Issues

### When Reporting Problems, Include:
1. **Screenshot** of the issue
2. **Booking ID** for reference
3. **Browser console errors** (if any)
4. **Step-by-step reproduction** of the issue
5. **Expected vs Actual behavior**
6. **Device and browser information**

### Common Issue Categories
- **Real-time updates not working**
- **Status display problems**
- **UI/UX issues in dark mode**
- **Navigation or button problems**
- **Error handling issues**
- **Performance problems**

## Fixes Already Implemented

I've already made several improvements to handle common issues:

### 1. Better Status Logic
```tsx
// Improved payment status detection
const isPendingPayment = booking?.status === 'pending_payment_verification' || 
                        booking?.payment_status === 'pending' || 
                        booking?.status === 'pending';
const isConfirmed = booking?.status === 'confirmed' && booking?.payment_status === 'paid';
const isFailed = booking?.payment_status === 'failed' || booking?.status === 'cancelled';
```

### 2. Enhanced Real-time Updates
```tsx
// Added retry logic and better error handling
let retryCount = 0;
const maxRetries = 3;
// Exponential backoff for reconnection
```

### 3. Manual Refresh Option
```tsx
// Added refresh button for manual status updates
<button onClick={() => window.location.reload()}>
  Refresh Status
</button>
```

### 4. Better Error Display
```tsx
// Added failed payment state handling
{isFailed && (
  <div className="bg-red-500/5 border-red-500/20">
    Payment Failed - Try Again
  </div>
)}
```

### 5. Improved Admin Verification
```tsx
// Added better error handling and logging
console.log('Verifying payment:', { id, status, bookingId });
// Better error messages and rollback logic
```

## Next Steps

1. **Run through the testing checklist**
2. **Document any issues you find**
3. **Report back with specific problems**
4. **I'll fix any issues immediately**

The payment flow should now be much more robust with better error handling, retry logic, and user feedback. Test it thoroughly and let me know what you find!
