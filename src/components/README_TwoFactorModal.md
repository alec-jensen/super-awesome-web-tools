# TwoFactorModal Component

A reusable Astro component for 2FA verification that supports TOTP (Time-based One-Time Password) and backup codes.

## Features

- **Automatic method detection**: Detects available 2FA methods (TOTP, backup codes)
- **Method selection**: If multiple methods are available, prompts user to choose
- **Auto-focus**: Automatically focuses input for better UX
- **Error handling**: Displays validation errors inline
- **Escape key support**: Press ESC to cancel
- **Backdrop click**: Click outside modal to cancel
- **Promise-based API**: Returns a promise that resolves with the code or rejects on cancel

## Usage

### 1. Import the component

```astro
---
import TwoFactorModal from "../../components/TwoFactorModal.astro";
---
```

### 2. Add it to your page

```astro
<Layout>
  <!-- Your page content -->
  
  <!-- Add the modal component -->
  <TwoFactorModal />
</Layout>
```

### 3. Call the modal from JavaScript

The component exposes a global `window.show2FAModal()` function:

```javascript
try {
  const code = await window.show2FAModal(
    'Verify 2FA', // Optional: Custom title
    'Please verify your identity.' // Optional: Custom message
  );
  
  // Code was verified successfully
  console.log('2FA verified with code:', code);
  
} catch (error) {
  // User cancelled or error occurred
  console.log('2FA verification cancelled');
}
```

### Example: Protecting a sensitive action

```javascript
const deleteButton = document.getElementById('delete-account-btn');

deleteButton.addEventListener('click', async () => {
  // Check if user has 2FA enabled
  if (window.current2FAStatus?.totpEnabled || 
      window.current2FAStatus?.backupCodesRemaining > 0) {
    
    try {
      // Require 2FA verification before proceeding
      await window.show2FAModal(
        'Verify 2FA to Delete Account',
        'For security, please verify your identity with 2FA before deleting your account.'
      );
      
      // User verified - proceed with deletion
      await deleteAccount();
      
    } catch (err) {
      // User cancelled - do nothing
      return;
    }
  } else {
    // No 2FA enabled - proceed directly
    await deleteAccount();
  }
});
```

## API Reference

### `window.show2FAModal(title?, message?)`

**Parameters:**
- `title` (string, optional): Modal title. Default: `"Two-Factor Authentication Required"`
- `message` (string, optional): Modal message. Default: `"This action requires two-factor authentication."`

**Returns:**
- `Promise<string>`: Resolves with the verified code (either TOTP or backup code)

**Throws:**
- Rejects with `Error('Cancelled')` if user cancels
- Rejects with `Error('Failed to load 2FA status')` if API call fails
- Rejects with `Error('2FA Modal not found')` if modal elements are missing

### `window.current2FAStatus`

Global object containing the user's 2FA status:

```typescript
interface TwoFactorStatus {
  totpEnabled: boolean;        // Whether TOTP is enabled
  backupCodesRemaining: number; // Number of unused backup codes
  email: string;                // User's email address
}
```

This is automatically loaded when the modal is first opened.

## Styling

The component comes with built-in responsive styles. The modal uses:
- Dark overlay backdrop (50% opacity black)
- White modal with rounded corners
- Smooth fade-in animations
- Responsive width (90% on mobile, max 500px on desktop)
- Focus styles on inputs (blue ring)
- Error messages with red background

All styles are scoped to the component and won't affect the rest of your page.

## Security Notes

1. **API Verification**: The component calls `/api/auth/2fa/verify` to validate codes server-side
2. **Session Check**: Loads 2FA status from `/api/auth/2fa/status`
3. **One-time use**: Backup codes are consumed on successful verification
4. **No storage**: Codes are never stored in localStorage or cookies by the component

## Browser Support

Works in all modern browsers with JavaScript enabled. Requires:
- ES6+ (async/await, Promises, arrow functions)
- Fetch API
- DOM APIs (querySelector, addEventListener, etc.)

## Examples in This Project

See `src/pages/app/account.astro` for a complete example with:
- Change email protection
- Change password protection
- Delete account protection

All three actions require 2FA verification if enabled.
