
# Only setup for mac at the moment
if ! [ "$(uname)" == "Darwin" ]; then
  echo "Only mac install is supported via script."
  exit
fi

echo "===================="
echo "Running .dotfile installation script"

# Install and setup Stow
if ! command -v stow &> /dev/null
then
  echo "Stow not found, installing via homebrew"
  brew install stow
else
  echo "Stow found ☑"
fi

if [ ! -L $HOME/.zshrc ]
then

  echo "Running stow"
  cd $HOME/.dotfiles
  stow .
  cd $HOME
else
  echo "Symlinks found ☑"
fi

# Create this-env.sh
if [ ! -f $HOME/zsh/this-env.sh ]
then
  echo "Creating .this-env.sh"
  touch $HOME/zsh/this-env.sh
else
  echo "this-env.sh found ☑"
fi

# Cargo
if ! command -v cargo &> /dev/null
then
  echo "Cargo not found, installing via curl"
  curl https://sh.rustup.rs -sSf | sh
else
  echo "Cargo found ☑"
fi

# GCC
if ! command -v gcc &> /dev/null
then
  echo "GCC not found, installing via homebrew"
  brew install gcc
else
  echo "GCC found ☑"
fi

# Make
if ! command -v make &> /dev/null
then
  echo "Make not found, installing via homebrew"
  brew install make
else
  echo "Make found ☑"
fi

# Ripgrep
if ! command -v rg &> /dev/null
then
  echo "Ripgrep not found, installing via homebrew"
  brew install ripgrep
else
  echo "Ripgrep found ☑"
fi

# fzf
if ! command -v fzf &> /dev/null
then
  echo "fzf not found, installing via homebrew"
  brew install fzf
else
  echo "Fzf found ☑"
fi

# Zoxide
if ! command -v zoxide &> /dev/null
then
  echo "Zoxide not found, installing via cargo"
  cargo install zoxide --locked
else
  echo "Zoxide found ☑"

fi

# Eza
if ! command -v eza &> /dev/null
then
  echo "Eza not found, installing via homebrew"
  brew install eza
else
  echo "Eza found ☑"

fi

# Zsh
if ! command -v zsh &> /dev/null
then
  echo "Zsh not found, installing via homebrew"
  brew install zsh
else
  echo "Zsh found ☑"

fi

# Source nvm so it's available in this shell instance
if [ -f $(brew --prefix nvm)/nvm.sh ]
then
  echo "Sourcing nvm into shell ☑"
  . $(brew --prefix nvm)/nvm.sh
fi

# Nvm
if ! command -v nvm &> /dev/null
then
  echo "nvm not found, installing via homebrew"
  brew install nvm
else
  echo "nvm found ☑"

fi

# Wezterm
if ! command -v wezterm &> /dev/null
then
  echo "Wezterm not found, installing via homebrew (cask)"
  brew install --cask wezterm
else
  echo "Wezterm found ☑"
fi

# Starship prompt
if ! command -v starship &> /dev/null
then
  echo "Starship not found, installing via homebrew"
  brew install starship
else
  echo "Starship found ☑"
fi


# Zsh-Autosuggestions
if ! brew ls --versions zsh-autosuggestions > /dev/null;
then
  echo "Installing zsh-autosuggestions"
  brew install zsh-autosuggestions
else
  echo "zsh-autosuggestions found ☑"
fi

# Zsh-Syntax-Highlighting
if ! brew ls --versions zsh-syntax-highlighting > /dev/null;
then
  echo "Installing zsh-syntax-highlighting"
  brew install zsh-autosuggestions
else
  echo "zsh-syntax-highlighting found ☑"
fi

# Neovim
if ! command -v nvim &> /dev/null
then
  echo "===================="
  echo "Neovim not found, please install from the following link"
  echo "https://github.com/neovim/neovim/blob/master/INSTALL.md"
  echo "===================="
else
  echo "Neovim found ☑"
fi

# Font download prompt
echo "Download font of choice from https://www.nerdfonts.com/font-downloads"
echo "(0xProto Nerd Font) is my current preference"

echo ".dotfile installation script complete!"
echo "===================="
