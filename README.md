# Pseudo Driver AI

**A mobile-first, installable web app for experimental driver drowsiness monitoring and personalized alerts.**

Pseudo Driver AI is currently implemented as a **React + TypeScript Progressive Web App (PWA)**. It uses the device camera and MediaPipe vision tooling to estimate signs of eye closure and can escalate alerts to draw attention to possible drowsiness.

> **Safety notice:** This is an experimental prototype, not a certified driver-monitoring or automotive safety system. Detection may be inaccurate or fail due to lighting, camera placement, eyewear, face position, device performance, or browser restrictions. Never rely on this app as your only safety measure or interact with it while driving. If you feel sleepy, stop somewhere safe and rest.

## Features

- **Live camera monitoring** using the device's camera and MediaPipe Tasks Vision.
- **Face and eye-state estimation** using facial landmarks and vision-model outputs.
- **Temporal drowsiness evaluation** to assess eye-state signals over time instead of relying on a single frame.
- **Personalized voice warnings** using the browser's Web Speech Synthesis API.
- **Audio alarm** using the Web Audio API.
- **Vibration alerts** on supported devices and browsers through the Web Vibration API.
- **Driver preferences** such as driver name and alert settings stored in browser local storage where implemented.
- **Alert test and simulation controls** to help evaluate the alert experience without waiting for a detection event.
- **Foreground lifecycle handling** to pause or limit monitoring when the page is no longer active.
- **Installable PWA** with a web app manifest, icons, and service-worker caching.
- **Model and WebAssembly asset caching** to improve repeat-load and offline behavior.
- **Responsive interface** for mobile and desktop browser screens.

## How detection works

1. The app requests permission to use the device camera.
2. MediaPipe vision tasks process camera frames in the browser to estimate facial landmarks and related signals.
3. The app evaluates eye-state signals over time using heuristic logic.
4. When the configured logic indicates possible drowsiness, the app can escalate its alert output.
5. The user can use the available test/simulation controls to verify alert behavior.

Detection is heuristic-based. It is not a medical assessment and cannot determine whether a driver is safe to continue driving. Thresholds and behavior should be treated as experimental until validated across representative users, cameras, vehicles, lighting conditions, and operating environments.

## Technology stack

| Area | Technology |
| --- | --- |
| UI | React 19, TypeScript |
| Build tooling | Vite 6 |
| Styling | Tailwind CSS 4 |
| Computer vision | `@mediapipe/tasks-vision` |
| PWA / offline caching | `vite-plugin-pwa`, Workbox |
| Icons | Lucide React |
| Voice alerts | Web Speech Synthesis API |
| Alarm audio | Web Audio API |
| Haptics | Web Vibration API, where supported |
| Hosting automation | Firebase Hosting + GitHub Actions |

## Requirements

- Node.js 20 and npm (the GitHub Actions deployment workflow uses Node.js 20).
- A modern browser with camera access and WebAssembly support.
- A device with a usable camera; the front-facing camera is recommended for mobile use.
- **HTTPS for deployed camera access.** Browsers generally restrict camera access to secure contexts; localhost is suitable for local development.
- Audio playback may require an initial user interaction. Speech, vibration, and background behavior vary by browser and operating system.

## Run locally

Clone the repository and install dependencies:

```bash
git clone https://github.com/vivekpseudo/Pseudo-driver-ai.git
cd Pseudo-driver-ai
npm ci
npm run dev
```

Open the local URL printed by Vite. The development server is configured for port **3000**:

```text
http://localhost:3000
```

Grant camera permission when prompted and keep your face visible in the camera preview. Use the app's available alert test or simulation controls to evaluate alert output while safely parked.

### Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server on port 3000 |
| `npm run build` | Run the TypeScript build and create the production bundle |
| `npm run lint` | Run TypeScript checking with `tsc --noEmit` |
| `npm run preview` | Serve the production build locally on port 3000 |

Validate the build before deployment:

```bash
npm run lint
npm run build
npm run preview
```

## Progressive Web App and offline assets

PWA configuration is maintained in `vite.config.ts`. It defines the app manifest, standalone display mode, app icons, and service-worker caching. Local vision/model and WebAssembly assets are configured for caching so they can be reused after being downloaded.

Offline support does **not** guarantee that every feature works without a network connection on every device. Load the app online first, allow required assets to download, and verify behavior on the target browser. Camera access, audio playback, background operation, and vibration may be restricted by the operating system or browser.

## Deploy to Firebase Hosting

The repository contains a GitHub Actions workflow at [`.github/workflows/firebase-hosting.yml`](.github/workflows/firebase-hosting.yml). It runs on pushes to `main` and can also be started manually through `workflow_dispatch`. The workflow checks out the code, sets up Node.js 20, installs dependencies with `npm ci`, builds the app, and deploys to the live Firebase Hosting channel.

### Configure GitHub Actions secrets

In **GitHub → Settings → Secrets and variables → Actions**, configure these repository secrets:

| Secret | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_PSEUDO_DRIVER_AI` | Firebase service-account JSON for the deployment project |
| `FIREBASE_PROJECT_ID` | Firebase project ID |

Use the exact names above because the workflow references them. Never commit service-account JSON or credentials to the repository.

### Deployment steps

1. Create or select the Firebase project and configure Firebase Hosting.
2. Add the two GitHub Actions secrets listed above.
3. Verify the service account has the permissions needed to deploy to the selected project.
4. Push a commit to `main`, or start **Build and Deploy to Firebase Hosting** from the repository's Actions tab.
5. Inspect the workflow logs and open the Hosting URL after a successful run.

The workflow builds the application before deploying it, so a failed dependency installation or build will prevent deployment from completing.

## Troubleshooting

- **Camera does not start:** Use HTTPS or localhost, grant camera permission, check whether another app is using the camera, and reload the page.
- **Face/eyes are not detected reliably:** Improve front lighting, position the camera near eye level, keep the face visible, and avoid strong backlighting. Eyewear, occlusion, and movement can reduce reliability.
- **No sound is heard:** Interact with the page first, check device volume and browser settings, and use the alert test control. Browser autoplay policies can block audio until a user gesture.
- **No vibration:** The Web Vibration API is not supported on every browser or platform, including some iOS browser configurations.
- **Offline loading fails:** Open the app online first so the required model and WebAssembly assets can be downloaded and cached. Check browser storage and service-worker status.
- **Firebase deployment fails:** Verify the secret names, project ID, service-account permissions, and build logs.

## Testing checklist

Perform these checks while safely parked, not while driving:

- [ ] Camera permission and face tracking work on the target device/browser.
- [ ] The alert test plays the expected voice warning and alarm.
- [ ] Vibration works on supported hardware.
- [ ] Eye-closure simulation and recovery behavior work as expected.
- [ ] Monitoring pauses/resumes as intended when leaving and returning to the app.
- [ ] PWA installation and repeat-load/offline asset caching work on the target device.
- [ ] Behavior is evaluated under different lighting, camera positions, eyewear, and device performance.

A successful test on one device does not establish reliable performance in real driving conditions.

## Project structure

```text
.
├── .github/
│   └── workflows/
│       └── firebase-hosting.yml  # Build and deploy to Firebase Hosting
├── public/                       # Static assets, icons, and vision/model assets
├── src/
│   ├── components/               # Reusable UI components
│   ├── features/                 # Feature modules
│   ├── hooks/                    # React hooks
│   ├── App.tsx                   # Main application UI and flow
│   ├── index.css                 # Global styles
│   └── main.tsx                  # React entry point
├── index.html
├── package.json
├── vite.config.ts                # Vite and PWA configuration
└── tsconfig*.json
```

## Reference project

The original inspiration was [Portable AI-Based Drowsiness Detection and Alert System for Indian Truck Drivers](https://github.com/swapnil3104/Portable-AI-Based-Drowsiness-Detection-and-Alert-System-for-Indian-Truck-Drivers). This repository's current implementation is a browser-based React PWA, not the original Flutter app.

## License

See the repository's license file for applicable terms.
