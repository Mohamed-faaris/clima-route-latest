/// <reference types="vite/client" />

// Vite environment variables
interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
    readonly VITE_LOG_LEVEL?: string;
    readonly MODE?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Image imports
declare module '*.jpg' {
    const src: string;
    export default src;
}

declare module '*.jpeg' {
    const src: string;
    export default src;
}

declare module '*.png' {
    const src: string;
    export default src;
}

declare module '*.gif' {
    const src: string;
    export default src;
}

declare module '*.svg' {
    const src: string;
    export default src;
}

declare module '*.ico' {
    const src: string;
    export default src;
}

// Leaflet marker images
declare module 'leaflet/dist/images/marker-icon.png' {
    const src: string;
    export default src;
}

declare module 'leaflet/dist/images/marker-shadow.png' {
    const src: string;
    export default src;
}