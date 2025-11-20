# Modal Utilities

This module provides reusable modal functions to replace browser's native `alert()`, `confirm()`, and `prompt()` with styled, accessible modals.

## Why Use These?

- **Consistent styling**: Matches your application's design
- **Non-blocking**: All functions return Promises for better async/await flow
- **Accessible**: Keyboard navigation (Enter, Escape), focus management
- **Secure**: HTML escaping to prevent XSS
- **Modern UX**: Smooth animations and better user experience

## Installation

```javascript
import { showAlert, showConfirm, showPrompt } from '../../lib/modal.js';
```

## API Reference

### `showAlert(message, title?)`

Display an informational message to the user.

**Parameters:**
- `message` (string): The message to display
- `title` (string, optional): Modal title (default: 'Alert')

**Returns:** `Promise<void>`

**Example:**
```javascript
await showAlert('Your changes have been saved!', 'Success');
await showAlert('An error occurred', 'Error');
```

### `showConfirm(message, title?)`

Ask the user to confirm an action.

**Parameters:**
- `message` (string): The confirmation message
- `title` (string, optional): Modal title (default: 'Confirm')

**Returns:** `Promise<boolean>` - `true` if confirmed, `false` if cancelled

**Example:**
```javascript
const confirmed = await showConfirm(
  'Are you sure you want to delete this item?',
  'Delete Confirmation'
);

if (confirmed) {
  // User clicked "Confirm"
  deleteItem();
} else {
  // User clicked "Cancel" or pressed Escape
  console.log('Action cancelled');
}
```

### `showPrompt(message, title?, defaultValue?)`

Prompt the user to enter text.

**Parameters:**
- `message` (string): The prompt message
- `title` (string, optional): Modal title (default: 'Input Required')
- `defaultValue` (string, optional): Pre-filled value (default: '')

**Returns:** `Promise<string|null>` - The entered text, or `null` if cancelled

**Example:**
```javascript
const name = await showPrompt('Enter your name:', 'User Information', 'John Doe');

if (name !== null) {
  // User entered a value and clicked OK
  console.log('Name:', name);
} else {
  // User cancelled
  console.log('Input cancelled');
}
```

## Migration Guide

### Before (Native Dialogs)

```javascript
// Alert
alert('Something happened!');

// Confirm
if (confirm('Are you sure?')) {
  doSomething();
}

// Prompt
const input = prompt('Enter value:', 'default');
if (input) {
  processInput(input);
}
```

### After (Modal Utilities)

```javascript
import { showAlert, showConfirm, showPrompt } from '../../lib/modal.js';

// Alert
await showAlert('Something happened!');

// Confirm
const confirmed = await showConfirm('Are you sure?');
if (confirmed) {
  doSomething();
}

// Prompt
const input = await showPrompt('Enter value:', 'Input', 'default');
if (input !== null) {
  processInput(input);
}
```

## Features

### Keyboard Support
- **Enter**: Confirms action (OK/Confirm button)
- **Escape**: Cancels action (closes modal)
- **Tab**: Navigate between buttons

### Click Handling
- Clicking the backdrop (dark overlay) cancels the action
- Modal content prevents backdrop clicks from bubbling

### Styling
- Smooth fade-in and slide-in animations
- Gradient buttons matching app theme
- Responsive design (90% width on mobile, max 400px on desktop)
- High z-index (10000) to appear above other content

### Security
- All user input and messages are HTML-escaped to prevent XSS attacks
- Input validation recommended before processing prompt results

## Browser Compatibility

Works in all modern browsers that support:
- ES6 Promises
- Template literals
- `insertAdjacentHTML()`
- CSS animations

Tested in:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Notes

- Modals are automatically removed from DOM when closed
- Multiple modals can be shown simultaneously (though not recommended for UX)
- Event listeners are properly cleaned up to prevent memory leaks
- Animations are defined in a style tag added once to the document head
