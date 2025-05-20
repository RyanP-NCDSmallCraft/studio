# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{ pkgs, ... }: {
  # Which nixpkgs channel to use
  channel = "stable-24.11";

  # Packages used in the workspace
  packages = [
    pkgs.nodejs_20
    pkgs.zulu
  ];

  # Set environment variables for your Next.js Firebase app
  env = {
    NEXT_PUBLIC_FIREBASE_API_KEY = "AIzaSyDqFI4lztLRXbBK-CARVNfCVmdD4X0sEN0";
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "craftpal-5hvxp.firebaseapp.com";
    NEXT_PUBLIC_FIREBASE_PROJECT_ID = "craftpal-5hvxp";
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "craftpal-5hvxp.firebasestorage.app";
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "231622630853";
    NEXT_PUBLIC_FIREBASE_APP_ID = "1:231622630853:web:6a507f4d189852d0ca3fac";
  };

  # Enable Firebase emulators (optional - adjust as needed)
  services.firebase.emulators = {
    detect = true;
    projectId = "demo-app";
    services = [ "auth" "firestore" ];
  };

  # IDX workspace config
  idx = {
    extensions = [
      # Add VSCode extensions here (e.g., "vscodevim.vim")
    ];

    workspace = {
      onCreate = {
        default.openFiles = [
          "src/app/page.tsx"
        ];
      };
    };

   previews = {
    enable = true;
    previews = {
      # The following object sets web previews
      web = {
        command = [
          "npm"
          "run"
          "start"
          "--"
          "--port"
          "$PORT"
          "--host"
          "0.0.0.0"
          "--disable-host-check"
        ];
        manager = "web";
        # Optionally, specify a directory that contains your web app
        # cwd = "app/client";
      };
      # The following object sets Android previews
      # Note that this is supported only on Flutter workspaces
      android = {
        manager = "flutter";
      };
    };
  };
  };}