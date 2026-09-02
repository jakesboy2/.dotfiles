# Set path for mac vs linux
if [[ "$(uname)" == "Darwin" ]]; then
  export package_path="$(brew --prefix)"
  export opencode_path="$HOME/.opencode/bin"
else
  package_path="/usr/share"
  opencode_path="/home/jacob/.opencode/bin"
fi

# Vars
export ZDIR=$HOME/zsh

# Sourcing
source $ZDIR/alias.sh
source $ZDIR/this-env.sh
export PATH="$ZDIR/scripts:$PATH"

# Lazy load all plugins
for f in $ZDIR/plugins/*; do
  source $f
done

# Prompt. To customize, edit ~/.config/starship.toml.
eval "$(starship init zsh)"

# Better history setup
HISTFILE=$HOME/.zhistory
SAVEHIST=1000
HISTSIZE=999
setopt share_history
setopt hist_expire_dups_first
setopt hist_ignore_dups
setopt hist_verify

# completion using arrow keys (based on history)
bindkey '^[[A' history-search-backward
bindkey '^[[B' history-search-forward
export PATH="/usr/local/sbin:$PATH"

# opencode
export PATH=$opencode_path:$PATH
export OPENCODE_DISABLE_EXTERNAL_SKILLS=1

if [[ "$(uname)" == "Darwin" ]]; then
  source $package_path/share/zsh-autosuggestions/zsh-autosuggestions.zsh
  source $package_path/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
else
  source $package_path/zsh/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh
  source $package_path/zsh/plugins/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
fi

# bun completions
[ -s "/Users/jacob.waldrip/.bun/_bun" ] && source "/Users/jacob.waldrip/.bun/_bun"

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

. "$HOME/.local/bin/env"

# Deduplicate PATH entries (keep first occurrence, preserve order)
typeset -U path PATH
