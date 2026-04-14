{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  packages = with pkgs; [
    firefox
    geckodriver
    git
    nodejs_22
  ];

  shellHook = ''
    export FIREFOX_BIN="${pkgs.firefox}/bin/firefox"
    export GECKODRIVER_BIN="${pkgs.geckodriver}/bin/geckodriver"

    echo "firefox-devtools-mcp dev shell"
    echo "Node: $(node --version)"
    echo "npm: $(npm --version)"
    echo "Firefox: $(${pkgs.firefox}/bin/firefox --version | head -n 1)"
  '';
}
