# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{pkgs}: {
  # Which nixpkgs channel to use.
  channel = "stable-24.11"; # or "unstable"
  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20
    pkgs.zulu
  ];
  # Sets environment variables in the workspace
env = {
  NEXT_PUBLIC_FIREBASE_API_KEY = "AIzaSyDqFI4lztLRXbBK-CARVNfCVmdD4X0sEN0";
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "craftpal-5hvxp.firebaseapp.com";
  NEXT_PUBLIC_FIREBASE_PROJECT_ID = "craftpal-5hvxp";
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "craftpal-5hvxp.firebasestorage.app";
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "231622630853";
  NEXT_PUBLIC_FIREBASE_APP_ID = "1:231622630853:web:6a507f4d189852d0ca3fac";
};
  services.firebase.emulators = {
    detect = true;
    projectId = "demo-app";
    services = ["auth" "firestore"];
  };
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      # "vscodevim.vim"
    ];
    workspace = {
      onCreate = {
        default.openFiles = [
          "src/app/page.tsx"
        ];
      };
    };
    # Enable previews and customize configuration
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--hostname" "0.0.0.0"];
          manager = "web";
        };
      };
    };
  };
}
