{ pkgs, ... }: {
  channel = "stable-24.11";
  packages = [
    pkgs.nodejs_20,
    pkgs.git
  ];
  idx.extensions = [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss"
  ];
  idx.previews = {
    enable = true;
    previews = {
      web = {
        command = [
          "sh",
          "-c",
          "cd apps/web && npm run dev -- --port $PORT --hostname 0.0.0.0"
        ];
        manager = "web";
      };
    };
  };
  onCreate = {
    npm-install = "npm install";
  };
}
