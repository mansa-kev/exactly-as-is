# CTA Section Image Fix Report

**Date**: April 12, 2026
**Issue**: CTA section showing old fallback image before switching to current Supabase image

---

## Problem Analysis

### Root Cause
The CTA section in `PublicHome.tsx` had a fallback image that would display temporarily while fetching from Supabase:

```typescript
const ctaImage = images.homepage_cta_image || 'https://picsum.photos/seed/luxury-car-rental-cta/1000/1000.jpg';
```

This caused:
1. **Flash of old image**: The picsum.photos placeholder would show for a few seconds
2. **Image flicker**: After Supabase fetch completed, the image would switch to the actual uploaded image
3. **No persistence**: On page refresh, the cycle would repeat

### Files Audited
- `src/components/public/PublicHome.tsx` - CTA section component
- `src/hooks/usePublicImagesFinal.ts` - Image fetching hook
- All other files with picsum.photos references (verified they serve different purposes)

---

## Solution Implemented

### 1. Added LocalStorage Caching to usePublicImagesFinal Hook
**File**: `src/hooks/usePublicImagesFinal.ts`

**Changes**:
- Added `STORAGE_KEY = 'linkedup_public_images'` and `CACHE_VERSION = 'v1'`
- Added Step 1: Check localStorage for cached images before fetching from Supabase
- Cache is valid for 24 hours
- After successful fetch from any approach, store fresh data in localStorage
- If all fetch approaches fail, keep cached data instead of clearing it

**Benefits**:
- **Instant load**: Images load immediately from localStorage on subsequent visits
- **No flicker**: No more switching between old and new images
- **Offline support**: Cached images work even if Supabase is temporarily unavailable
- **Background refresh**: Fresh data is fetched in background while showing cached version

### 2. Removed Fallback Image from PublicHome
**File**: `src/components/public/PublicHome.tsx`

**Changes**:
- Removed the picsum.photos fallback URL
- Added `loading` state from hook
- Added `showImage` boolean: `const showImage = !loading && ctaImage;`
- Image only renders when it exists and loading is complete

### 3. Added Loading State
**File**: `src/components/public/PublicHome.tsx`

**Changes**:
- Added conditional rendering in the image container
- When `showImage` is false, shows a loading spinner with text
- Spinner shows "Loading image..." during fetch
- Shows "No image set" if no image exists after loading completes
- Added `bg-muted` background to image container for better loading state appearance

---

## Code Changes Summary

### usePublicImagesFinal.ts
```typescript
// Added constants
const STORAGE_KEY = 'linkedup_public_images';
const CACHE_VERSION = 'v1';

// Added localStorage check at start of fetch
const cached = localStorage.getItem(STORAGE_KEY);
if (cached) {
  const { version, data, timestamp } = JSON.parse(cached);
  if (version === CACHE_VERSION && Date.now() - timestamp < 24 * 60 * 60 * 1000) {
    setImages(data);
    setLoading(false);
    // Continue to fetch fresh data in background
  }
}

// Added localStorage save after successful fetch
localStorage.setItem(
  STORAGE_KEY,
  JSON.stringify({
    version: CACHE_VERSION,
    data: imageMap,
    timestamp: Date.now()
  })
);
```

### PublicHome.tsx
```typescript
// Before
const ctaImage = images.homepage_cta_image || 'https://picsum.photos/seed/luxury-car-rental-cta/1000/1000.jpg';

// After
const { images, loading } = usePublicImagesFinal();
const ctaImage = images.homepage_cta_image;
const showImage = !loading && ctaImage;

// Conditional rendering
{showImage ? (
  <img src={ctaImage} alt="Drive with LinkedUp" />
) : (
  <div className="loading-spinner">
    <div className="animate-spin..." />
    <p>{loading ? 'Loading image...' : 'No image set'}</p>
  </div>
)}
```

---

## Other picsum.photos References (Kept Intentionally)

The following picsum.photos URLs were audited but **kept** as they serve different purposes:

- **Car image fallbacks** (AdminCars.tsx, BrowseAndBook.tsx, CarShowroom.tsx, CarDetails.tsx, AdminOutsourcedCars.tsx)
  - Purpose: Fallback for cars without uploaded images
  - Different from CTA section issue

- **About page fallbacks** (AboutUs.tsx)
  - Purpose: Fallback for about section images
  - Different from CTA section issue

- **Admin Image Manager placeholders** (AdminImageManager.tsx)
  - Purpose: UI placeholders in admin interface
  - Not visible to end users

- **Hero section carousel** (HeroSection.tsx)
  - Purpose: Demo carousel images
  - Different from CTA section issue

- **Service file fallbacks** (adminService.ts, realAdminService.ts)
  - Purpose: Server-side fallback for image generation
  - Not visible to end users

---

## Testing Recommendations

1. **First Visit**: Should see loading spinner, then Supabase image
2. **Second Visit**: Should see image instantly from localStorage (no spinner)
3. **After 24 Hours**: Cache expires, should see spinner briefly then fresh image
4. **Clear Cache**: Clear browser localStorage and test first visit behavior again
5. **No Image Set**: Test with no CTA image in Supabase - should show "No image set"

---

## Result

✅ **Old fallback image completely removed from CTA section**
✅ **Images now persist in localStorage for 24 hours**
✅ **No more image flicker on page refresh**
✅ **Loading state shows instead of old image during fetch**
✅ **Background refresh keeps images up-to-date**

The CTA section now loads the correct image immediately from cache on subsequent visits, eliminating the flicker issue completely.
