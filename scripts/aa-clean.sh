#!/bin/bash

set -e

echo ""
echo "🧹 Cleaning local Account Abstraction (AA) setup..."
echo "---------------------------------------------------"

# Remove symlink
SYMLINK_PATH="packages/hardhat/contracts/@account-abstraction/contracts"

if [ -L "$SYMLINK_PATH" ]; then
  rm "$SYMLINK_PATH"
  echo "✅ Symlink removed at $SYMLINK_PATH"
elif [ -e "$SYMLINK_PATH" ]; then
  echo "❌ $SYMLINK_PATH exists but is not a symlink. Please remove manually."
else
  echo "ℹ️  No symlink found at $SYMLINK_PATH"
fi

# Remove @account-abstraction directory
AA_SYMLINK_PATH="packages/hardhat/contracts/@account-abstraction"
if [ -d "$AA_SYMLINK_PATH" ]; then
  rm -rf "$AA_SYMLINK_PATH"
  echo "✅ Removed @account-abstraction directory at $AA_SYMLINK_PATH" 
else
  echo "ℹ️  No @account-abstraction directory found at $AA_SYMLINK_PATH"
fi
  
# Remove cloned aa-lib
AA_LIB_PATH="packages/aa-lib"
if [ -d "$AA_LIB_PATH" ]; then
  rm -rf "$AA_LIB_PATH"
  echo "✅ Removed local clone at $AA_LIB_PATH" 
else
  echo "ℹ️  No local clone found at $AA_LIB_PATH"
fi

echo ""
echo "✅ Cleanup completed successfully."
echo ""
