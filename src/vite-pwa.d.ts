/// <reference types="vite-plugin-pwa/client" />
declare module "virtual:pwa-register" {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: any) => void;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
  }
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}