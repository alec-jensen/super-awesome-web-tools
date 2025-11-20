// Database utility script for user management
// Run with: node scripts/user-admin.js

import { query } from '../src/lib/db.js';

async function listUsers() {
  console.log('\n=== Users in Database ===\n');
  const users = await query('SELECT id, email, role, email_verified, created_at FROM users ORDER BY id');
  
  if (!users || users.length === 0) {
    console.log('No users found in database.\n');
    return;
  }

  users.forEach((user, index) => {
    const roleIcon = user.role === 'admin' ? '👑' : '👤';
    console.log(`${index + 1}. ${roleIcon} ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role.toUpperCase()}`);
    console.log(`   Verified: ${user.email_verified ? 'Yes' : 'No'}`);
    console.log(`   Created: ${user.created_at}`);
    console.log('');
  });
  
  console.log(`Total users: ${users.length}\n`);
}

async function makeAdmin(email) {
  if (!email) {
    console.error('Error: Email address required');
    console.log('Usage: node scripts/user-admin.js make-admin <email>');
    return;
  }

  const result = await query('UPDATE users SET role = ? WHERE email = ?', ['admin', email.toLowerCase()]);
  
  if (result.affectedRows === 0) {
    console.log(`No user found with email: ${email}`);
  } else {
    console.log(`✓ User ${email} is now an admin`);
  }
}

async function makeFirstUserAdmin() {
  console.log('\n=== Making First User Admin ===\n');
  
  const users = await query('SELECT id, email, role FROM users ORDER BY id LIMIT 1');
  
  if (!users || users.length === 0) {
    console.log('No users found in database.\n');
    return;
  }

  const firstUser = users[0];
  
  if (firstUser.role === 'admin') {
    console.log(`First user (${firstUser.email}) is already an admin.\n`);
    return;
  }

  await query('UPDATE users SET role = ? WHERE id = ?', ['admin', firstUser.id]);
  console.log(`✓ First user (${firstUser.email}) is now an admin\n`);
}

async function countUsers() {
  const result = await query('SELECT COUNT(*) as count FROM users');
  const count = result[0].count;
  console.log(`\nTotal users in database: ${count}\n`);
  return count;
}

async function clearAllUsers() {
  console.log('\n⚠️  WARNING: This will delete ALL users and sessions!\n');
  
  // In a real scenario, you'd want to confirm this action
  // For now, we'll just show what would be deleted
  const users = await query('SELECT COUNT(*) as count FROM users');
  const sessions = await query('SELECT COUNT(*) as count FROM sessions');
  
  console.log(`Users to delete: ${users[0].count}`);
  console.log(`Sessions to delete: ${sessions[0].count}`);
  console.log('\nTo actually delete, uncomment the DELETE statements in the script.\n');
  
  // Uncomment these lines to actually delete:
  // await query('DELETE FROM sessions');
  // await query('DELETE FROM users');
  // console.log('✓ All users and sessions deleted.\n');
}

// Main script
const command = process.argv[2];
const arg = process.argv[3];

try {
  switch (command) {
    case 'list':
      await listUsers();
      break;
    
    case 'count':
      await countUsers();
      break;
    
    case 'make-admin':
      await makeAdmin(arg);
      break;
    
    case 'make-first-admin':
      await makeFirstUserAdmin();
      break;
    
    case 'clear':
      await clearAllUsers();
      break;
    
    default:
      console.log('\nDatabase User Admin Utility\n');
      console.log('Usage: node scripts/user-admin.js <command> [args]\n');
      console.log('Commands:');
      console.log('  list                  - List all users');
      console.log('  count                 - Count total users');
      console.log('  make-admin <email>    - Make a specific user an admin');
      console.log('  make-first-admin      - Make the first user (by ID) an admin');
      console.log('  clear                 - Clear all users (shows info only)');
      console.log('');
  }
  
  process.exit(0);
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
