# #!/bin/bash

# set -e

# echo ""
# echo "⚙️ Initializing local Account Abstraction (AA) setup..."
# echo "--------------------------------------------------------"

# # Clone AA v0.8 only if not already present
# if [ ! -d "packages/aa-lib" ]; then
#   echo "🔄 Cloning Account Abstraction release/v0.8..."
#   git clone --depth=1 --branch=releases/v0.8 https://github.com/eth-infinitism/account-abstraction.git packages/aa-lib
# else
#   echo "✅ packages/aa-lib already exists. Skipping clone."
# fi

# # Ensure @account-abstraction directory exists
# mkdir -p packages/hardhat/contracts/@account-abstraction

# # Create symlink in hardhat/contracts/
# ln -sfn ../../../aa-lib/contracts packages/hardhat/contracts/@account-abstraction/contracts

# echo "✅ Symlink created at: packages/hardhat/contracts/@account-abstraction/contracts"
# echo ""
#!/bin/bash

set -e

echo ""
echo "⚙️ Initializing local Account Abstraction (AA) setup..."
echo "--------------------------------------------------------"

# Clone AA v0.8 if not already present
if [ ! -d "packages/aa-lib" ]; then
  echo "🔄 Cloning Account Abstraction release/v0.8..."
  git clone --depth=1 --branch=releases/v0.8 https://github.com/eth-infinitism/account-abstraction.git packages/aa-lib
else
  echo "✅ packages/aa-lib already exists. Skipping clone."
fi

# Prepare destination directory
DEST_DIR="packages/hardhat/contracts/@account-abstraction/contracts"
mkdir -p "$DEST_DIR"

# Copy only core folders: core, interfaces, utils
for folder in accounts core interfaces utils; do
  echo "📁 Copying $folder..."
  cp -R "packages/aa-lib/contracts/$folder" "$DEST_DIR"
done

echo "✅ Local copy completed at: $DEST_DIR"
echo ""
